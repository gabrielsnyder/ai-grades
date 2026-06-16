export const dynamic = 'force-dynamic'

import { prisma } from '../../../lib/db'
import FlagQueue from '../../../components/FlagQueue'

async function getData() {
  const assessments = await prisma.assessment.findMany({
    where: { reviewStatus: 'FLAGGED' },
    include: {
      candidate: true,
      indicator: { include: { question: true } },
      sources: { include: { source: true } },
      flags: {
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return assessments.map((a) => ({
    id: a.id,
    value: a.value,
    rationale: a.rationale,
    reviewStatus: a.reviewStatus,
    candidate: { id: a.candidate.id, name: a.candidate.name, state: a.candidate.state, party: a.candidate.party },
    question: { id: a.indicator.question.id, text: a.indicator.question.text, order: a.indicator.question.order },
    indicator: { id: a.indicator.id, name: a.indicator.name, type: a.indicator.type },
    sources: a.sources.map(as => ({ id: as.source.id, url: as.source.url, title: as.source.title, excerpt: as.source.excerpt })),
    flags: a.flags.map(f => ({ id: f.id, reason: f.reason, severity: f.severity, confidence: f.confidence })),
  }))
}

export default async function FlagsPage() {
  const items = await getData()

  return (
    <div className="page-wrap">
      <div className="page-header">
        <h1>Flag Queue</h1>
        <span style={{ fontSize: 13, color: '#888' }}>
          {items.length} flagged assessment{items.length !== 1 ? 's' : ''} awaiting review
        </span>
      </div>
      {items.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
            No flagged assessments. The Verifier will add items here when it lacks confidence.
          </div>
        </div>
      ) : (
        <FlagQueue items={items} />
      )}
    </div>
  )
}
