import { NextResponse } from 'next/server'
import { runResearcher } from '../../../../lib/agents/researcher.js'

export async function POST(request) {
  try {
    const { candidateId, questionIds, provider, dryRun } = await request.json()
    if (!candidateId) return NextResponse.json({ error: 'candidateId required' }, { status: 400 })
    const result = await runResearcher({
      candidateId,
      questionIds: questionIds ?? null,
      provider: provider ?? 'minimax',
      dryRun: dryRun ?? false,
    })
    return NextResponse.json(result)
  } catch (e) {
    console.error('[researcher]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
