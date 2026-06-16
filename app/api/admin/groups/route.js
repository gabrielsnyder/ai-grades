import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'

export async function POST(request) {
  try {
    const { name, description } = await request.json()
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    const group = await prisma.candidateGroup.create({
      data: { name, description },
    })
    return NextResponse.json(group, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
