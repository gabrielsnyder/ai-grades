import { NextResponse } from 'next/server'
import { loadVotesForSignal } from '../../../../../../lib/votes/loader.js'

// POST /api/admin/bills/[id]/load — (re)load member votes for this signal
export async function POST(request, { params }) {
  try {
    const evidenceCreated = await loadVotesForSignal(params.id)
    return NextResponse.json({ ok: true, evidenceCreated })
  } catch (e) {
    console.error('[bills/load]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
