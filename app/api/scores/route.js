import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/db'

export async function POST(request) {
  try {
    const { candidateId, questionId } = await request.json()

    const existing = await prisma.score.findUnique({
      where: { candidateId_questionId: { candidateId, questionId } },
    })
    if (existing) return NextResponse.json(existing)

    const score = await prisma.score.create({
      data: { candidateId, questionId },
    })
    return NextResponse.json(score, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
