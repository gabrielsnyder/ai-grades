import { NextResponse } from 'next/server'
import { runPipeline } from '../../../../lib/agents/pipeline.js'

export async function POST(request) {
  try {
    const { candidateId, questionIds, provider, dryRun } = await request.json()
    if (!candidateId) return NextResponse.json({ error: 'candidateId required' }, { status: 400 })
    const result = await runPipeline({
      candidateId,
      questionIds: questionIds ?? null,
      provider: provider ?? 'minimax',
      dryRun: dryRun ?? false,
    })
    return NextResponse.json(result)
  } catch (e) {
    console.error('[pipeline]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
