import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/db'

export async function DELETE(request, { params }) {
  try {
    await prisma.user.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
