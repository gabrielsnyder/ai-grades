import { NextResponse } from 'next/server'
import { runAssessor } from '../../../../lib/agents/assessor.js'

export async function POST(request) {
  try {
    const { candidateId, indicatorId, provider, dryRun } = await request.json()

    if (!candidateId || !indicatorId) {
      return NextResponse.json({ error: 'candidateId and indicatorId are required' }, { status: 400 })
    }

    const result = await runAssessor({
      candidateId,
      indicatorId,
      provider: provider ?? 'claude',
      dryRun: dryRun ?? false,
    })

    return NextResponse.json(result)
  } catch (e) {
    const status = e.message?.includes('HUMAN_REVIEWED') ? 403 : 500
    console.error('[assessor]', e)
    return NextResponse.json({ error: e.message }, { status })
  }
}
