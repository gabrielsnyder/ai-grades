import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'

export async function PUT(request) {
  try {
    const { weights } = await request.json()

    const activeProfile = await prisma.weightingProfile.findFirst({ where: { isActive: true } })
    if (!activeProfile) {
      return NextResponse.json({ error: 'No active weighting profile' }, { status: 404 })
    }

    const validTypes = ['BILL_VOTE', 'PUBLIC_STATEMENT', 'CAMPAIGN_STATEMENT', 'CUSTOM']
    const updates = []

    for (const type of validTypes) {
      const weight = typeof weights[type] === 'number' ? weights[type] : undefined
      if (weight === undefined) continue
      if (weight < 0) return NextResponse.json({ error: `Weight for ${type} must be >= 0` }, { status: 400 })

      updates.push(
        prisma.typeWeight.upsert({
          where: { profileId_type: { profileId: activeProfile.id, type } },
          update: { weight },
          create: { profileId: activeProfile.id, type, weight },
        })
      )
    }

    await prisma.$transaction(updates)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
