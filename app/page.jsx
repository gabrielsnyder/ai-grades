export const dynamic = 'force-dynamic'

import { prisma } from '../lib/db'
import { weightedScore, overallScore, resolveWeight } from '../lib/scoring'
import Scorecard from '../components/Scorecard'

async function getData() {
  const [questions, candidates, activeProfile] = await Promise.all([
    prisma.question.findMany({ orderBy: { order: 'asc' } }),
    prisma.candidate.findMany({
      include: {
        assessments: {
          where: { reviewStatus: { in: ['MACHINE_VERIFIED', 'AUTO_CORRECTED', 'HUMAN_REVIEWED'] } },
          include: {
            indicator: true,
            sources: { include: { source: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.weightingProfile.findFirst({
      where: { isActive: true },
      include: { typeWeights: true },
    }),
  ])

  const typeWeights = {}
  if (activeProfile) {
    for (const tw of activeProfile.typeWeights) typeWeights[tw.type] = tw.weight
  }

  const processed = candidates.map((c) => {
    const questionScores = questions.map((q) => {
      const assessments = c.assessments.filter(a => a.indicator.questionId === q.id)
      const items = assessments.map(a => ({ value: a.value, weight: resolveWeight(a, typeWeights) }))
      const computed = weightedScore(items)
      const primary = assessments[0]
      const sources = assessments.flatMap(a =>
        a.sources.map(as => ({
          id: as.source.id,
          url: as.source.url,
          title: as.source.title,
          excerpt: as.source.excerpt,
        }))
      )
      return {
        questionId: q.id,
        questionText: q.text,
        questionDesc: q.description,
        computed,
        rationale: primary?.rationale ?? null,
        sources,
      }
    })

    const avg = overallScore(questionScores.map(s => s.computed))
    const answered = questionScores.filter(s => s.computed !== null).length

    return { id: c.id, name: c.name, state: c.state, party: c.party, questionScores, overallScore: avg, answeredCount: answered }
  })

  return { candidates: processed, questions }
}

export default async function HomePage() {
  const { candidates, questions } = await getData()

  return (
    <div className="app">
      <header className="header">
        <h1>Senate AI Policy Tracker — 2026 Incumbents</h1>
        <p>Class 2 senators running for reelection · Scored from public statements, votes, and legislation as of June 2026 · For editorial review</p>
      </header>

      <Scorecard candidates={candidates} questions={questions} />

      <footer className="footer">
        <p>
          <strong>Questions: </strong>
          {questions.map((q, i) => `Q${i + 1} ${q.text}`).join(' — ')}
        </p>
        <p>
          <strong>Scoring: </strong>
          1 = most skeptic/restrictive · 5 = most pro-acceleration/deregulatory · Scores of 2 and 4 mark intermediate positions · "–" = no publicly stated position (excluded from average)
        </p>
        <p>
          <strong>Key vote: </strong>
          The Q2 score for virtually all incumbents is anchored by the July 1, 2025 Senate vote (99–1) to strip the 10-year AI moratorium on state regulations from the "One Big Beautiful Bill."
        </p>
      </footer>
    </div>
  )
}
