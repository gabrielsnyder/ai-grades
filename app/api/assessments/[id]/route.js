import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'

export async function PUT(request, { params }) {
  try {
    const { value, rationale } = await request.json()

    const existing = await prisma.assessment.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Agents must never overwrite a human-reviewed assessment
    if (existing.reviewStatus === 'HUMAN_REVIEWED') {
      return NextResponse.json({ error: 'Cannot modify a HUMAN_REVIEWED assessment' }, { status: 403 })
    }

    const updated = await prisma.assessment.update({
      where: { id: params.id },
      data: {
        value: value ?? null,
        rationale: rationale ?? null,
        reviewStatus: 'HUMAN_REVIEWED',
        origin: 'HUMAN',
      },
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
