import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/db.js'
import { loadVotesForSignal } from '../../../../../lib/votes/loader.js'

// PUT /api/admin/bills/[id] — update yesMeans or questionId, re-score Evidence
export async function PUT(request, { params }) {
  try {
    const { id } = params
    const { yesMeans, questionId } = await request.json()

    const signal = await prisma.signal.findUnique({
      where: { id },
      include: { rollCall: { include: { bill: true } } },
    })
    if (!signal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.signal.update({
      where: { id },
      data: {
        ...(yesMeans   != null && { yesMeans }),
        ...(questionId != null && { questionId }),
      },
    })

    // Re-score all existing Evidence rows for this signal using the new yesMeans
    const effectiveYesMeans = yesMeans ?? signal.yesMeans
    const votes = await prisma.memberVote.findMany({ where: { rollCallId: signal.rollCallId ?? '' } })
    for (const { bioguideId, position } of votes) {
      const candidate = await prisma.candidate.findFirst({ where: { bioguideId } })
      if (!candidate) continue
      const stance = position === 'YES' ? effectiveYesMeans : position === 'NO' ? 6 - effectiveYesMeans : null
      if (stance === null) continue
      await prisma.evidence.updateMany({
        where: { signalId: id, candidateId: candidate.id },
        data:  { stance },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[bills PUT]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/admin/bills/[id] — remove signal and cascade Evidence
export async function DELETE(request, { params }) {
  try {
    const { id } = params
    await prisma.evidence.deleteMany({ where: { signalId: id } })
    await prisma.signal.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
