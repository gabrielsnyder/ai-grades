import { prisma } from '../db.js'
import { getClient } from '../llm.js'

// Tool-use schema for structured output — portable across providers that lack
// native output_config.format (tool use works everywhere).
const ASSESS_TOOL = {
  name: 'record_assessment',
  description: 'Record the scoring assessment for this candidate on this indicator.',
  input_schema: {
    type: 'object',
    properties: {
      value: {
        type: 'integer',
        minimum: 1,
        maximum: 5,
        description: 'Score 1–5 per the rubric (1 = strongly against, 5 = strongly for AI safety/advancement).',
      },
      rationale: {
        type: 'string',
        description: 'Concise evidence-based reasoning (2–4 sentences). Cite specific sources by ID.',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence in this score (0–1). Use < 0.6 when sources are absent or ambiguous.',
      },
      citedSourceIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Source IDs (from the provided list) that support this assessment.',
      },
    },
    required: ['value', 'rationale', 'confidence'],
  },
}

/**
 * Runs the Assessor agent for one (candidate × indicator) pair.
 *
 * @param {{ candidateId, indicatorId, provider?, dryRun? }} opts
 * @returns assessment row + confidence + agentRunId (or dry-run summary)
 */
export async function runAssessor({ candidateId, indicatorId, provider = 'claude', dryRun = false }) {
  const [candidate, indicator, sources, existing] = await Promise.all([
    prisma.candidate.findUnique({ where: { id: candidateId } }),
    prisma.indicator.findUnique({ where: { id: indicatorId }, include: { question: true } }),
    prisma.source.findMany({
      where: { candidateId, status: { in: ['FOUND', 'VERIFIED'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.assessment.findUnique({
      where: { candidateId_indicatorId: { candidateId, indicatorId } },
    }),
  ])

  if (!candidate) throw new Error(`Candidate not found: ${candidateId}`)
  if (!indicator) throw new Error(`Indicator not found: ${indicatorId}`)
  if (existing?.reviewStatus === 'HUMAN_REVIEWED') {
    throw new Error('Cannot reassess a HUMAN_REVIEWED assessment — human edit is authoritative.')
  }

  // ── Build prompt ─────────────────────────────────────────────────────────
  // System carries the rubric (stable prefix → prompt cache hit on repeat calls
  // for this indicator). User carries the variable candidate + sources suffix.

  const systemText = `You are an AI policy analyst scoring U.S. political candidates on AI-related policy indicators.

## Indicator
**Name:** ${indicator.name}
**Parent question:** ${indicator.question.text}
**Type:** ${indicator.type}

## Scoring Rubric
${indicator.rubric}

## Instructions
- Score 1–5 based strictly on the rubric above.
- Ground your score in the provided sources. If sources are absent, draw on general public knowledge but lower your confidence accordingly.
- Be concise in your rationale (2–4 sentences).
- Only cite source IDs that appear in the provided list.`

  const sourceLines = sources.length > 0
    ? sources.map(s =>
        `[${s.id}]\nTitle: ${s.title || 'Untitled'}\nURL: ${s.url || 'N/A'}\n${s.excerpt ? `Excerpt: ${s.excerpt.slice(0, 600)}` : '(no excerpt)'}`
      ).join('\n\n---\n\n')
    : '(No sources available — score from general public knowledge if possible.)'

  const userText = `## Candidate
Name: ${candidate.name}
Party: ${candidate.party}
State: ${candidate.state}${candidate.office ? `\nOffice: ${candidate.office}` : ''}

## Sources
${sourceLines}

Score ${candidate.name} on "${indicator.name}".`

  if (dryRun) {
    return {
      dryRun: true,
      candidateId,
      indicatorId,
      provider,
      sourceCount: sources.length,
      estimatedInputLength: systemText.length + userText.length,
    }
  }

  // ── Create AgentRun ───────────────────────────────────────────────────────
  const agentRun = await prisma.agentRun.create({
    data: {
      type: 'ASSESSOR',
      status: 'RUNNING',
      scope: { candidateId, indicatorId },
      provider,
    },
  })

  const { client, model } = getClient(provider)

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userText }],
      tools: [ASSESS_TOOL],
      tool_choice: { type: 'any' },
    })

    const toolBlock = response.content.find(b => b.type === 'tool_use')
    if (!toolBlock) throw new Error('Assessor returned no tool_use block')

    const { value, rationale, confidence, citedSourceIds = [] } = toolBlock.input

    // ── Write Assessment (upsert in place) ────────────────────────────────
    const assessment = existing
      ? await prisma.assessment.update({
          where: { id: existing.id },
          data: {
            value,
            rationale,
            reviewStatus: 'UNVERIFIED',
            origin: 'AGENT',
            agentRunId: agentRun.id,
            rubricVersion: indicator.rubricVersion,
          },
        })
      : await prisma.assessment.create({
          data: {
            candidateId,
            indicatorId,
            value,
            rationale,
            reviewStatus: 'UNVERIFIED',
            origin: 'AGENT',
            agentRunId: agentRun.id,
            rubricVersion: indicator.rubricVersion,
          },
        })

    // ── Link cited sources (replace prior links) ──────────────────────────
    const validSourceIds = sources
      .filter(s => citedSourceIds.includes(s.id))
      .map(s => s.id)

    await prisma.$transaction([
      prisma.assessmentSource.deleteMany({ where: { assessmentId: assessment.id } }),
      ...validSourceIds.map(sourceId =>
        prisma.assessmentSource.create({ data: { assessmentId: assessment.id, sourceId } })
      ),
    ])

    // ── Close out AgentRun ────────────────────────────────────────────────
    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: {
        status: 'DONE',
        model,
        costInputTokens: response.usage?.input_tokens ?? null,
        costOutputTokens: response.usage?.output_tokens ?? null,
        finishedAt: new Date(),
      },
    })

    return { assessment, confidence, agentRunId: agentRun.id }
  } catch (err) {
    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: { status: 'FAILED', error: err.message, finishedAt: new Date() },
    })
    throw err
  }
}
