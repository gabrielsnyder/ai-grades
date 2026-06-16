import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/db'

export async function GET(request, { params }) {
  try {
    const components = await prisma.scoreComponent.findMany({
      where: { scoreId: params.id },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(components)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  try {
    const body = await request.json()
    const component = await prisma.scoreComponent.create({
      data: {
        scoreId: params.id,
        type: body.type ?? 'CUSTOM',
        value: body.value,
        weight: body.weight ?? 1.0,
        sourceUrl: body.sourceUrl ?? null,
        sourceLabel: body.sourceLabel ?? null,
        notes: body.notes ?? null,
      },
    })
    return NextResponse.json(component, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
