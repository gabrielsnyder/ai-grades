import { prisma } from '../db.js'

const SERPER_URL = 'https://google.serper.dev/search'

function normalizeQuery(q) {
  return q.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Runs the Researcher agent for one (candidate × indicator) pair.
 * Checks SearchCache first; calls Serper on a miss and saves the result.
 * Creates Source rows (deduplicated by URL within the candidate).
 *
 * @param {{ candidateId, indicatorId, dryRun? }} opts
 */
export async function runResearcher({ candidateId, indicatorId, dryRun = false }) {
  const [candidate, indicator] = await Promise.all([
    prisma.candidate.findUnique({ where: { id: candidateId } }),
    prisma.indicator.findUnique({ where: { id: indicatorId }, include: { question: true } }),
  ])

  if (!candidate) throw new Error(`Candidate not found: ${candidateId}`)
  if (!indicator) throw new Error(`Indicator not found: ${indicatorId}`)

  const query = `${candidate.name} ${candidate.state} AI policy ${indicator.question.text}`
  const normalizedQuery = normalizeQuery(query)

  if (dryRun) {
    return { dryRun: true, query, normalizedQuery, candidateId, indicatorId }
  }

  const agentRun = await prisma.agentRun.create({
    data: {
      type: 'RESEARCHER',
      status: 'RUNNING',
      scope: { candidateId, indicatorId },
      provider: 'serper',
    },
  })

  let searchCount = 0
  let cacheHitCount = 0

  try {
    // ── Cache-first lookup ────────────────────────────────────────────────
    const cached = await prisma.searchCache.findFirst({
      where: {
        normalizedQuery,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    })

    let results
    if (cached) {
      cacheHitCount++
      results = cached.results
      await prisma.searchCache.update({
        where: { id: cached.id },
        data: {
          hitCount: { increment: 1 },
          candidateId: cached.candidateId ?? candidateId,
          indicatorId: cached.indicatorId ?? indicatorId,
        },
      })
    } else {
      // ── Serper call ───────────────────────────────────────────────────
      searchCount++
      const resp = await fetch(SERPER_URL, {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY ?? '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: 10 }),
      })
      if (!resp.ok) throw new Error(`Serper ${resp.status}: ${await resp.text()}`)

      results = await resp.json()

      // 30-day TTL — political positions don't change daily
      await prisma.searchCache.create({
        data: {
          query,
          normalizedQuery,
          results,
          resultCount: results.organic?.length ?? 0,
          source: 'SERPER',
          candidateId,
          indicatorId,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
    }

    // ── Create Source rows (deduplicated by URL within candidate) ─────────
    const organic = results.organic ?? []
    const created = []

    for (const hit of organic.slice(0, 10)) {
      if (!hit.link) continue

      const existing = await prisma.source.findFirst({
        where: { candidateId, url: hit.link },
      })
      if (existing) continue

      const source = await prisma.source.create({
        data: {
          candidateId,
          url: hit.link,
          title: hit.title ?? null,
          excerpt: hit.snippet ?? null,
          status: 'FOUND',
          agentRunId: agentRun.id,
        },
      })
      created.push(source)
    }

    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: { status: 'DONE', searchCount, cacheHitCount, finishedAt: new Date() },
    })

    return { sources: created, searchCount, cacheHitCount, agentRunId: agentRun.id }
  } catch (err) {
    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: { status: 'FAILED', error: err.message, finishedAt: new Date() },
    })
    throw err
  }
}
