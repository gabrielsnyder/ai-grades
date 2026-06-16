import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/db'

export async function PUT(request, { params }) {
  try {
    const { text, description } = await request.json()
    const question = await prisma.question.update({
      where: { id: params.id },
      data: { text, ...(description !== undefined && { description }) },
    })
    return NextResponse.json(question)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
