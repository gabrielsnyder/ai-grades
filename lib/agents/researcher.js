import { getClient } from '../llm.js'
import { prisma } from '../db.js'

const SERPER_URL = 'https://google.serper.dev/search'

const RECORD_FINDINGS_TOOL = {
  name: 'record_findings',
  description: 'Record all evidence found about this candidate\'s AI policy positions',
  input_schema: {
    type: 'object',
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            questionId: { type: 'string', description: 'ID of the question this evidence addresses' },
            type: { type: 'string', enum: ['BILL_VOTE', 'PUBLIC_STATEMENT', 'CAMPAIGN_STATEMENT', 'CUSTOM'] },
            indicatorName: {
              type: 'string',
              description: 'Canonical short name for this specific piece of evidence. Bill votes: "S.1234 – AI Safety Act (2025)". Statements: "Senate floor speech on AI safety, Mar 2026". Must be specific enough to deduplicate across runs.'
            },
            meta: {
              type: 'object',
              description: 'Structured data for bill votes',
              properties: {
                billId:       { type: 'string',  description: 'Official bill ID, e.g. S.1234 or H.R.5678' },
                billTitle:    { type: 'string',  description: 'Short bill title' },
                congress:     { type: 'integer', description: 'Congress session number, e.g. 119' },
                votePosition: { type: 'string',  enum: ['YES', 'NO', 'PRESENT', 'ABSENT'] }
              }
            },
            sourceUrl:   { type: 'string' },
            sourceTitle: { type: 'string' },
            excerpt:     { type: 'string',  description: 'Relevant quote or description from the source' },
            confidence:  { type: 'number',  description: '0–1 confidence this evidence is accurate and relevant' }
          },
          required: ['questionId', 'type', 'indicatorName', 'excerpt', 'confidence']
        }
      }
    },
    required: ['findings']
  }
}

function normalizeQuery(q) {
  return q.toLowerCase().trim().replace(/\s+/g, ' ')
}

async function serperSearch(query, candidateId) {
  const normalizedQuery = normalizeQuery(query)

  const cached = await prisma.searchCache.findFirst({
    where: { normalizedQuery, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
  })
  if (cached) {
    await prisma.searchCache.update({ where: { id: cached.id }, data: { hitCount: { increment: 1 } } })
    return { results: cached.results, fromCache: true }
  }

  const resp = await fetch(SERPER_URL, {
    method: 'POST',
    headers: { 'X-API-KEY': process.env.SERPER_API_KEY ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: 10 }),
  })
  if (!resp.ok) throw new Error(`Serper ${resp.status}: ${await resp.text()}`)
  const results = await resp.json()

  await prisma.searchCache.create({
    data: {
      query, normalizedQuery, results,
      resultCount: results.organic?.length ?? 0,
      source: 'SERPER', candidateId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
  return { results, fromCache: false }
}

function formatOrganic(hits = [], limit = 5) {
  return hits.slice(0, limit).map(r =>
    `- [${r.title}](${r.link})\n  ${r.snippet ?? '(no snippet)'}`
  ).join('\n')
}

/**
 * Runs the Researcher for one candidate across all (or specified) questions.
 * Searches for evidence, uses an LLM to categorize findings into typed evidence
 * (BILL_VOTE / PUBLIC_STATEMENT / CAMPAIGN_STATEMENT / CUSTOM), creates Source rows,
 * and returns structured findings for the Assessor to score.
 */
export async function runResearcher({ candidateId, questionIds, provider = 'minimax', dryRun = false }) {
  const [candidate, allQuestions] = await Promise.all([
    prisma.candidate.findUnique({ where: { id: candidateId } }),
    prisma.question.findMany({ orderBy: { order: 'asc' } }),
  ])
  if (!candidate) throw new Error(`Candidate not found: ${candidateId}`)

  const questions = questionIds
    ? allQuestions.filter(q => questionIds.includes(q.id))
    : allQuestions

  if (dryRun) {
    return {
      dryRun: true,
      candidateId,
      candidate: candidate.name,
      queries: [
        ...questions.map(q => `${candidate.name} ${candidate.state} "${q.shortLabel || q.text}" AI policy`),
        `${candidate.name} ${candidate.state} senator AI bill vote congress`,
      ],
    }
  }

  const agentRun = await prisma.agentRun.create({
    data: {
      type: 'RESEARCHER',
      status: 'RUNNING',
      scope: { candidateId, questionIds: questionIds ?? 'all' },
      provider,
    },
  })

  let searchCount = 0
  let cacheHitCount = 0

  try {
    // ── Search phase ──────────────────────────────────────────────────────────
    const questionSearches = []
    for (const q of questions) {
      const query = `${candidate.name} ${candidate.state} senator "${q.shortLabel || q.text}" AI`
      const { results, fromCache } = await serperSearch(query, candidateId)
      fromCache ? cacheHitCount++ : searchCount++
      questionSearches.push({ question: q, query, organic: results.organic ?? [] })
    }

    // Broad bill-vote sweep
    const voteQuery = `${candidate.name} ${candidate.state} senator AI bill vote congress`
    const { results: voteResults, fromCache: voteFromCache } = await serperSearch(voteQuery, candidateId)
    voteFromCache ? cacheHitCount++ : searchCount++

    // ── LLM categorization phase ──────────────────────────────────────────────
    const { client, model } = getClient(provider)

    const questionsCtx = questions.map((q, i) =>
      `Q${i + 1} [id: ${q.id}]: ${q.text}\n   ${q.description ?? ''}`
    ).join('\n\n')

    const searchCtx = [
      ...questionSearches.map(({ query, organic }) =>
        `### Search: "${query}"\n${formatOrganic(organic)}`
      ),
      `### Search: "${voteQuery}"\n${formatOrganic(voteResults.organic ?? [])}`,
    ].join('\n\n')

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      tools: [RECORD_FINDINGS_TOOL],
      tool_choice: { type: 'any' },
      system: [
        {
          type: 'text',
          text: [
            'You are a political research assistant extracting structured evidence about a legislator\'s AI policy positions from search results.',
            '',
            'Evidence types:',
            '- BILL_VOTE: a roll-call vote on specific legislation. Extract billId (e.g. S.1234 or H.R.5678), billTitle, congress session, and votePosition (YES/NO/PRESENT/ABSENT).',
            '- PUBLIC_STATEMENT: floor speeches, committee hearings, press releases, op-eds, interviews.',
            '- CAMPAIGN_STATEMENT: campaign ads, fundraising emails, debate statements, campaign website.',
            '- CUSTOM: any other relevant evidence that doesn\'t fit the above.',
            '',
            'Rules:',
            '- Only record evidence you are confident is accurate and directly relevant to the question.',
            '- Do not fabricate or infer — only record what is explicitly stated in the search results.',
            '- Each BILL_VOTE must name a specific bill; do not record vague references to "legislation".',
            '- Give each finding a specific, canonical indicatorName that will deduplicate across future runs.',
            '- Confidence < 0.6: skip it.',
          ].join('\n'),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{
        role: 'user',
        content: [
          `Candidate: ${candidate.name} (${candidate.party}, ${candidate.state}, ${candidate.office ?? 'Congress'})`,
          '',
          'Policy questions to assess:',
          questionsCtx,
          '',
          'Search results:',
          searchCtx,
          '',
          'Extract all relevant evidence. Assign each finding to the most relevant questionId.',
        ].join('\n'),
      }],
    })

    const toolUse = response.content.find(b => b.type === 'tool_use')
    const rawFindings = toolUse?.input?.findings ?? []

    // ── Create Source rows & build finding records ────────────────────────────
    const findings = []
    for (const f of rawFindings) {
      if ((f.confidence ?? 0) < 0.6) continue
      if (!questions.find(q => q.id === f.questionId)) continue

      let sourceId = null
      if (f.sourceUrl) {
        const existing = await prisma.source.findFirst({ where: { candidateId, url: f.sourceUrl } })
        if (existing) {
          sourceId = existing.id
        } else {
          const src = await prisma.source.create({
            data: {
              candidateId, url: f.sourceUrl, title: f.sourceTitle ?? null,
              excerpt: f.excerpt ?? null, status: 'FOUND', agentRunId: agentRun.id,
            },
          })
          sourceId = src.id
        }
      }

      findings.push({
        questionId: f.questionId,
        type: f.type,
        indicatorName: f.indicatorName,
        meta: f.meta ?? {},
        sourceId,
        excerpt: f.excerpt,
        confidence: f.confidence,
      })
    }

    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: {
        status: 'DONE', searchCount, cacheHitCount,
        costInputTokens: response.usage?.input_tokens ?? 0,
        costOutputTokens: response.usage?.output_tokens ?? 0,
        finishedAt: new Date(),
      },
    })

    return { findings, searchCount, cacheHitCount, agentRunId: agentRun.id }
  } catch (err) {
    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: { status: 'FAILED', error: err.message, finishedAt: new Date() },
    })
    throw err
  }
}
