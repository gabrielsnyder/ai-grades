import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/db'

export async function PUT(request, { params }) {
  try {
    const { candidateId, questionId, notes } = await request.json()

    let scoreId = params.id
    if (scoreId === 'new') {
      const existing = await prisma.score.findUnique({
        where: { candidateId_questionId: { candidateId, questionId } },
      })
      if (existing) {
        scoreId = existing.id
      } else {
        const created = await prisma.score.create({ data: { candidateId, questionId, notes } })
        return NextResponse.json(created)
      }
    }

    const score = await prisma.score.update({
      where: { id: scoreId },
      data: { notes },
    })
    return NextResponse.json(score)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
