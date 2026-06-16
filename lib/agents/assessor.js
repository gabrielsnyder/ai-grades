import { prisma } from '../db.js'
import { getClient } from '../llm.js'

// Full scoring framework derived from the AI Policy Candidate Questionnaire.
// This is the stable system-level context shared across every assessor call
// (good candidate for prompt caching).
const SCORING_FRAMEWORK = `\
## Skeptic–Booster Spectrum

Score every indicator on a 1–5 scale:

- **1 — AI Skeptic**: favors precaution, restriction, and public oversight as the default response to AI development.
- **3 — Mixed / contextual**: conditional or intermediate positions — support in principle with significant caveats, or split-the-difference approaches.
- **5 — AI Booster**: favors minimal restriction and rapid deployment as the default response to AI development.

Scores of 2 and 4 represent intermediate positions between the 1/3/5 anchors.

## Critical scoring principles

1. **Direction, not topic**: "raised concerns about AI" tells you nothing without knowing the direction. Concerns that AI is dangerous and should be restricted → lean Skeptic (1–2). Concerns that we lack adequate safety frameworks to let AI flourish → lean Booster (4–5). Neutral procedural awareness → 3.
2. **No data ≠ 3**: If there is genuinely no evidence of a position, report low confidence rather than defaulting to 3. A candidate who has not addressed an issue is not the same as one with a moderate position.
3. **Evidence strength**: a bill vote or co-sponsorship is stronger signal than a floor remark; a floor remark stronger than an endorsement signal; an endorsement signal stronger than no data.
4. **Single hearing remark with no clear direction**: score 3 with confidence ≤ 0.5.

## Per-question rubric anchors

Use these anchors to calibrate scores. The indicator you are scoring maps to one or more of these 16 questions. Match to the closest one(s).

### A. Regulation & Safety Oversight

**A1. Federal vs. state authority**
- 1 (Skeptic): Opposes federal preemption. Supports states' authority to enact and enforce their own AI safety/transparency laws as a check on industry.
- 3 (Mixed): Supports a federal "floor, not ceiling" — minimum national standards that states may exceed — or preemption limited to narrow technical standards.
- 5 (Booster): Supports full federal preemption of state AI laws to create a single, uniform, lighter-touch national standard.

**A2. Pre-deployment safety testing**
- 1 (Skeptic): Supports mandatory pre-deployment licensing/testing by an independent or government body for frontier models, with release contingent on passing.
- 3 (Mixed): Supports voluntary commitments or industry-run safety evaluations with public reporting, but no government approval gate.
- 5 (Booster): Opposes any mandatory pre-release testing regime; relies on post-deployment market and liability mechanisms only.

**A3. Liability for AI harms**
- 1 (Skeptic): Supports expanded liability, including for foreseeable downstream harms, with limited safe harbors.
- 3 (Mixed): Supports liability calibrated to negligence or foreseeability — liability attaches if a company ignored known risks — with safe harbors for good-faith compliance.
- 5 (Booster): Opposes new AI-specific liability regimes; existing product-liability/tort law is sufficient, or platforms should receive Section 230–style protection.

**A4. Whistleblower protections**
- 1 (Skeptic): Supports strong, AI-specific whistleblower protections, including anti-retaliation and disclosure rights that can override NDAs.
- 3 (Mixed): Supports protections, but limited to reporting through formal regulatory channels rather than public disclosure.
- 5 (Booster): Opposes new AI-specific whistleblower statutes; treats this as adequately covered by general employment law or unnecessary.

### B. Labor & Economic Impact

**B1. Worker transition support**
- 1 (Skeptic): Supports a new, well-funded federal program specifically targeting AI-driven displacement.
- 3 (Mixed): Supports folding AI displacement into existing workforce programs (e.g., Trade Adjustment Assistance, WIOA) without new dedicated funding.
- 5 (Booster): Opposes new federal programs; views labor-market adjustment as a matter for the private sector or states.

**B2. Algorithmic employment decisions**
- 1 (Skeptic): Supports mandatory disclosure, audit, and appeal rights for AI-driven employment decisions.
- 3 (Mixed): Supports disclosure requirements only, without a formal audit or appeal mandate.
- 5 (Booster): Opposes new disclosure or audit mandates for employers' use of AI tools.

**B3. Automation-linked redistribution**
- 1 (Skeptic): Supports new automation-linked taxes or dividend/UBI-style programs funded by AI productivity gains.
- 3 (Mixed): Open to studying or piloting such mechanisms without committing to them.
- 5 (Booster): Opposes automation taxes or AI-linked dividends; views general tax/transfer policy as sufficient or such measures as harmful to growth.

**B4. Data center buildout**
- 1 (Skeptic): Supports added environmental review, ratepayer protections (e.g., AI firms cover grid-upgrade costs), and community approval before new data centers are built.
- 3 (Mixed): Supports targeted ratepayer-cost-allocation rules without broader new permitting hurdles.
- 5 (Booster): Opposes additional permitting or ratepayer requirements; supports streamlining data center construction as an economic and strategic priority.

### C. Industry Competition & Innovation

**C1. Concentration of AI power**
- 1 (Skeptic): Supports aggressive antitrust action — e.g., blocking mergers, restricting vertical integration of model developers and cloud providers, possible breakups.
- 3 (Mixed): Supports heightened, case-by-case merger review and scrutiny without committing to structural remedies.
- 5 (Booster): Opposes new antitrust action targeted at AI firms; views current market structure as a competitive advantage or a natural result of innovation.

**C2. Public investment in AI**
- 1 (Skeptic): Opposes new subsidies aimed at accelerating industry; would direct public funds toward AI oversight, safety research, or other priorities instead.
- 3 (Mixed): Supports funding for public-interest or safety-oriented AI research and infrastructure (e.g., academic compute access) but not broad industry subsidies.
- 5 (Booster): Supports significant public investment or subsidies aimed at accelerating frontier AI development and infrastructure (e.g., a national compute buildout).

**C3. Open-weight models**
- 1 (Skeptic): Supports government restrictions — e.g., export controls or release-gating — on open-weight models above a capability threshold, due to misuse risk.
- 3 (Mixed): Supports voluntary risk assessments before open release, but no binding government restriction.
- 5 (Booster): Opposes government restrictions on open-weight release; treats open-weight development as a net benefit for competition and security research.

**C4. U.S.-China AI competition**
- 1 (Skeptic): Prioritizes international cooperation on AI safety standards, including with China, even if this means accepting some constraints on the pace of unilateral U.S. development.
- 3 (Mixed): Supports targeted export controls on military/dual-use applications while pursuing safety dialogue on civilian AI.
- 5 (Booster): Prioritizes winning the "AI race" through export controls and accelerated domestic development, with minimal emphasis on multilateral coordination.

### D. Government Use & Civil Liberties

**D1. Government use of AI**
- 1 (Skeptic): Supports binding limits — e.g., bans on certain uses such as facial recognition in policing, mandatory human review of benefits denials, algorithmic impact assessments.
- 3 (Mixed): Supports transparency/disclosure requirements (agencies must disclose AI use) without binding use restrictions.
- 5 (Booster): Opposes new legal limits on government AI use beyond existing law; treats this as an operational, agency-level matter.

**D2. Synthetic media disclosure**
- 1 (Skeptic): Supports mandatory labeling/disclosure for AI-generated content generally, with specific bans on undisclosed synthetic media in political ads close to elections.
- 3 (Mixed): Supports disclosure requirements limited to political advertising only.
- 5 (Booster): Opposes new mandatory labeling laws; views existing fraud/defamation law and platform policies as sufficient.

**D3. Data privacy for AI training**
- 1 (Skeptic): Supports a comprehensive federal AI/data-privacy law with opt-in consent requirements and deletion rights for training data.
- 3 (Mixed): Supports an opt-out model (data may be used unless an individual objects) paired with disclosure requirements.
- 5 (Booster): Opposes new federal data-privacy legislation specific to AI training; existing sector-specific privacy laws are sufficient.

**D4. Kids' AI safety**
- 1 (Skeptic): Supports binding restrictions: age verification, limits on companion chatbots for minors, and bans on AI tools holding themselves out as licensed professionals.
- 3 (Mixed): Supports disclosure/labeling requirements (chatbots must identify as AI) without broader access restrictions.
- 5 (Booster): Opposes new binding restrictions; relies on parental controls, platform self-regulation, or existing consumer-protection law.`

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
export async function runAssessor({ candidateId, indicatorId, provider = 'minimax', dryRun = false }) {
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
  // Two-block system message:
  //   Block 1 (stable) — the full scoring framework; cache_control caches this prefix
  //     across every assessor call regardless of indicator.
  //   Block 2 (variable) — indicator-specific context; not cached.

  const systemBlocks = [
    {
      type: 'text',
      text: `You are an AI policy analyst scoring U.S. political candidates on AI-related policy indicators using the Skeptic–Booster framework.\n\n${SCORING_FRAMEWORK}`,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: [
        '## Indicator being scored',
        `**Name:** ${indicator.name}`,
        `**Parent question:** ${indicator.question.text}`,
        `**Type:** ${indicator.type}`,
        '',
        '## Indicator-specific rubric context',
        indicator.rubric,
        '',
        '## Instructions',
        '- Score 1–5 using the per-question anchors above that best match this indicator.',
        '- If the indicator is a BILL_VOTE, the vote position and bill purpose determine the score directly.',
        '- If the indicator is a PUBLIC_STATEMENT, evaluate the directional stance — not just that the topic was mentioned.',
        '- If sources are absent, draw on general public knowledge but set confidence < 0.6.',
        '- Be concise in your rationale (2–4 sentences). Cite specific sources by ID.',
        '- Only cite source IDs that appear in the provided list.',
      ].join('\n'),
    },
  ]

  // Use sequential reference numbers [1], [2] instead of raw DB IDs so the LLM
  // writes human-readable citations in the rationale.
  const sourceRefMap = {} // refNum (string) → sourceId
  const sourceLines = sources.length > 0
    ? sources.map((s, i) => {
        const ref = `${i + 1}`
        sourceRefMap[ref] = s.id
        return `[${ref}] ${s.title || 'Untitled'}\n${s.url || ''}\n${s.excerpt ? s.excerpt.slice(0, 600) : '(no excerpt)'}`
      }).join('\n\n---\n\n')
    : '(No sources available — score from general public knowledge if possible.)'

  const userText = `## Candidate
Name: ${candidate.name}
Party: ${candidate.party}
State: ${candidate.state}${candidate.office ? `\nOffice: ${candidate.office}` : ''}

## Sources (cite by reference number, e.g. [1])
${sourceLines}

Score ${candidate.name} on "${indicator.name}".`

  if (dryRun) {
    return {
      dryRun: true,
      candidateId,
      indicatorId,
      provider,
      sourceCount: sources.length,
      estimatedInputLength: systemBlocks.reduce((n, b) => n + b.text.length, 0) + userText.length,
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
      system: systemBlocks,
      messages: [{ role: 'user', content: userText }],
      tools: [ASSESS_TOOL],
      tool_choice: { type: 'any' },
    })

    const toolBlock = response.content.find(b => b.type === 'tool_use')
    if (!toolBlock) throw new Error('Assessor returned no tool_use block')

    const { value, confidence, citedSourceIds: rawCitedRefs = [] } = toolBlock.input
    let { rationale } = toolBlock.input

    // Replace [1], [2] refs in rationale with the source title for readability
    if (sources.length > 0) {
      rationale = rationale.replace(/\[(\d+)\]/g, (match, num) => {
        const src = sources[parseInt(num, 10) - 1]
        return src?.title ? `(${src.title})` : match
      })
    }

    // Map numbered refs back to actual source IDs for AssessmentSource links
    const citedSourceIds = rawCitedRefs
      .map(ref => sourceRefMap[String(ref)] ?? ref)
      .filter(id => sources.some(s => s.id === id))

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
    await prisma.$transaction([
      prisma.assessmentSource.deleteMany({ where: { assessmentId: assessment.id } }),
      ...citedSourceIds.map(sourceId =>
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

/**
 * findOrCreate an Indicator from a researcher finding, then score it.
 * The @@unique([questionId, type, name]) constraint makes upsert safe.
 */
export async function runAssessorFromFinding({ candidateId, finding, provider = 'minimax' }) {
  const question = await prisma.question.findUnique({ where: { id: finding.questionId } })
  if (!question) throw new Error(`Question not found: ${finding.questionId}`)

  // Build a rubric that supplements the global SCORING_FRAMEWORK with finding-specific facts.
  // For BILL_VOTEs include the bill details; for statements the framework provides the guidance.
  const rubricParts = [
    `Parent question: ${question.text}`,
    question.description ? `Context: ${question.description}` : '',
  ]
  if (finding.type === 'BILL_VOTE' && finding.meta?.billId) {
    rubricParts.push(
      `Bill: ${finding.meta.billId}${finding.meta.billTitle ? ` – ${finding.meta.billTitle}` : ''}`,
      finding.meta.votePosition ? `Candidate voted: ${finding.meta.votePosition}` : '',
      'Score based on whether this bill is pro-safety/restriction (Skeptic) or anti-restriction/pro-deployment (Booster).',
    )
  }
  const rubric = rubricParts.filter(Boolean).join('\n')

  const indicator = await prisma.indicator.upsert({
    where: { questionId_type_name: { questionId: finding.questionId, type: finding.type, name: finding.indicatorName } },
    create: {
      questionId: finding.questionId,
      name: finding.indicatorName,
      type: finding.type,
      rubric,
      chamber: finding.chamber ?? null,
      meta: finding.meta && Object.keys(finding.meta).length > 0 ? finding.meta : null,
      rubricVersion: 1,
    },
    update: {},
  })

  return runAssessor({ candidateId, indicatorId: indicator.id, provider })
}
