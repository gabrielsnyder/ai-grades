import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/db'

export async function PUT(request, { params }) {
  try {
    const body = await request.json()
    const component = await prisma.scoreComponent.update({
      where: { id: params.componentId },
      data: {
        type: body.type,
        value: body.value,
        weight: body.weight,
        sourceUrl: body.sourceUrl ?? null,
        sourceLabel: body.sourceLabel ?? null,
        notes: body.notes ?? null,
      },
    })
    return NextResponse.json(component)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    await prisma.scoreComponent.delete({ where: { id: params.componentId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
