import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db.js'
import { discoverAndLoadBill } from '../../../../lib/votes/loader.js'

// GET /api/admin/bills — list all VOTE signals with bill/evidence stats
export async function GET() {
  const signals = await prisma.signal.findMany({
    where: { kind: 'VOTE' },
    include: {
      question:  { select: { id: true, text: true, order: true } },
      rollCall:  { include: { bill: true } },
    },
    orderBy: { question: { order: 'asc' } },
  })

  // Attach evidence counts per signal
  const withCounts = await Promise.all(signals.map(async (s) => {
    const total      = await prisma.evidence.count({ where: { signalId: s.id } })
    const published  = await prisma.evidence.count({ where: { signalId: s.id, reviewStatus: { in: ['PUBLISHED', 'HUMAN_REVIEWED'] } } })
    return {
      id:           s.id,
      title:        s.title,
      yesMeans:     s.yesMeans,
      chamber:      s.chamber,
      question:     s.question,
      bill:         s.rollCall?.bill ?? null,
      rollCall:     s.rollCall ? { id: s.rollCall.id, number: s.rollCall.number, loadStatus: s.rollCall.loadStatus, loadedAt: s.rollCall.loadedAt, loadError: s.rollCall.loadError } : null,
      evidenceTotal:     total,
      evidencePublished: published,
    }
  }))

  return NextResponse.json(withCounts)
}

// POST /api/admin/bills — manually add a bill signal
export async function POST(request) {
  try {
    const { billId, billTitle, congress, questionId, yesMeans } = await request.json()
    if (!billId || !questionId || !yesMeans) {
      return NextResponse.json({ error: 'billId, questionId, and yesMeans are required' }, { status: 400 })
    }
    const result = await discoverAndLoadBill({
      questionId,
      meta: { billId, billTitle, congress: congress ?? 119, yesMeans },
    })
    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    console.error('[bills POST]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
