import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/db'

export async function POST(request, { params }) {
  try {
    const { action, value, rationale } = await request.json()

    const existing = await prisma.assessment.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let updateData
    if (action === 'confirm') {
      // Human confirms the current value is correct → publish it
      updateData = { reviewStatus: 'HUMAN_REVIEWED', origin: 'HUMAN' }
    } else if (action === 'correct') {
      // Human corrects value/rationale → publish with edits
      updateData = {
        value: value ?? null,
        rationale: rationale ?? null,
        reviewStatus: 'HUMAN_REVIEWED',
        origin: 'HUMAN',
      }
    } else if (action === 'dismiss') {
      // Flag was a false positive → mark machine-verified so it's published
      updateData = { reviewStatus: 'MACHINE_VERIFIED' }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const [updated] = await prisma.$transaction([
      prisma.assessment.update({ where: { id: params.id }, data: updateData }),
      // Close all open flags on this assessment
      prisma.flag.updateMany({
        where: { assessmentId: params.id, status: 'OPEN' },
        data: { status: 'RESOLVED' },
      }),
    ])

    return NextResponse.json(updated)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
