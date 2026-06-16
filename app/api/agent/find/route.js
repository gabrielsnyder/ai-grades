import { NextResponse } from 'next/server'
import { runFinder } from '../../../../lib/agents/finder.js'

export async function POST(request) {
  try {
    const { offices, cycle, dryRun } = await request.json()
    const result = await runFinder({
      offices: offices ?? ['S', 'H'],
      cycle: cycle ?? 2026,
      dryRun: dryRun ?? false,
    })
    return NextResponse.json(result)
  } catch (e) {
    console.error('[finder]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
