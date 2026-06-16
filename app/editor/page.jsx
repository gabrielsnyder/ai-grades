export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '../../lib/db'
import { weightedScore, overallScore, resolveWeight, scoreLabel, scoreColor } from '../../lib/scoring'

async function getCandidates() {
  const [candidates, questions, activeProfile] = await Promise.all([
    prisma.candidate.findMany({
      include: {
        assessments: { include: { indicator: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.question.findMany({ orderBy: { order: 'asc' } }),
    prisma.weightingProfile.findFirst({
      where: { isActive: true },
      include: { typeWeights: true },
    }),
  ])

  const typeWeights = {}
  if (activeProfile) {
    for (const tw of activeProfile.typeWeights) typeWeights[tw.type] = tw.weight
  }
  const qCount = questions.length

  return candidates.map((c) => {
    const qScores = questions.map((q) => {
      const assessments = c.assessments.filter(a => a.indicator.questionId === q.id)
      const items = assessments.map(a => ({ value: a.value, weight: resolveWeight(a, typeWeights) }))
      return weightedScore(items)
    })
    const avg = overallScore(qScores)
    const answered = qScores.filter(v => v !== null).length
    return { ...c, overallScore: avg, answeredCount: answered, totalQ: qCount }
  })
}

export default async function EditorPage() {
  const candidates = await getCandidates()

  return (
    <div className="page-wrap">
      <div className="page-header">
        <h1>Candidates</h1>
        <span style={{ fontSize: 13, color: '#888' }}>{candidates.length} total</span>
      </div>

      <div className="card">
        <table className="table-simple">
          <thead>
            <tr>
              <th>Name</th>
              <th>State</th>
              <th>Party</th>
              <th>Overall Score</th>
              <th>Coverage</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td style={{ color: '#555' }}>{c.state}</td>
                <td>
                  <span className={`party-badge ${c.party}`}>{c.party}</span>
                </td>
                <td>
                  {c.overallScore !== null ? (
                    <span style={{ fontWeight: 700, color: scoreColor(c.overallScore) }}>
                      {c.overallScore.toFixed(1)} <span style={{ fontWeight: 400, color: '#666', fontSize: 12 }}>{scoreLabel(c.overallScore)}</span>
                    </span>
                  ) : (
                    <span style={{ color: '#aaa' }}>—</span>
                  )}
                </td>
                <td style={{ color: '#666', fontSize: 13 }}>
                  {c.answeredCount}/{c.totalQ} questions
                </td>
                <td>
                  <Link href={`/editor/candidates/${c.id}`} className="btn-ghost" style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>
                    Edit scores
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
