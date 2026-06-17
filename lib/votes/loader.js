/**
 * Vote pipeline: given a Signal (kind=VOTE), fetch all member votes from
 * the relevant congressional data source and create Evidence rows for every
 * matched candidate.
 *
 * Call loadVotesForSignal(signalId) to trigger. Safe to re-run (upserts).
 */

import { prisma } from '../db.js'
import {
  fetchBillInfo, findRollCalls, fetchHouseMemberVotes, fetchSenateMemberVotes,
  parseBillId, normalizeBillNumber,
} from './congress.js'

/**
 * Given a researcher's BILL_VOTE finding, upsert the Bill + Signal + RollCall,
 * then load all member votes and create Evidence for matched candidates.
 *
 * finding: { questionId, meta: { billId, billTitle, congress, votePosition, yesMeans } }
 * Returns { signalId, billId, evidenceCreated }
 */
export async function discoverAndLoadBill({ questionId, meta }) {
  const parsed = parseBillId(meta.billId)
  if (!parsed) throw new Error(`Cannot parse bill ID: ${meta.billId}`)

  const { type, number, chamber } = parsed
  const congress = meta.congress ?? 119
  const normalizedNum = normalizeBillNumber(type, number)

  // ── Upsert Bill ──────────────────────────────────────────────────────────
  let bill = await prisma.bill.findUnique({
    where: { congress_chamber_number: { congress, chamber, number: normalizedNum } },
  })

  if (!bill) {
    let title = meta.billTitle ?? `${meta.billId}`
    try {
      const info = await fetchBillInfo(congress, type, number)
      title = info.title
    } catch (e) {
      console.warn(`[votes] Congress.gov metadata fetch failed for ${meta.billId}: ${e.message}`)
    }
    bill = await prisma.bill.create({
      data: { congress, chamber, number: normalizedNum, title },
    })
  }

  // ── Find or create Signal ────────────────────────────────────────────────
  // yesMeans: what a YES vote means on the 1-5 skeptic↔booster scale
  const yesMeans = meta.yesMeans ?? 3
  let signal = await prisma.signal.findFirst({
    where: { questionId, kind: 'VOTE', rollCall: { bill: { id: bill.id } } },
    include: { rollCall: true },
  })

  if (!signal) {
    // Find or create RollCall — we start with a placeholder; actual roll number
    // will be filled in when we fetch from Congress.gov
    const rollCallData = await ensureRollCall(bill, congress, type, number, chamber)
    signal = await prisma.signal.create({
      data: {
        questionId,
        kind: 'VOTE',
        title: `${meta.billId} – ${bill.title}`,
        chamber,
        rollCallId: rollCallData.id,
        yesMeans,
      },
    })
  }

  // ── Load votes ───────────────────────────────────────────────────────────
  const created = await loadVotesForSignal(signal.id)
  return { signalId: signal.id, billId: bill.id, evidenceCreated: created }
}

/**
 * (Re)load all member votes for a Signal and create/update Evidence rows
 * for matched candidates. Safe to re-run.
 */
export async function loadVotesForSignal(signalId) {
  const signal = await prisma.signal.findUnique({
    where: { id: signalId },
    include: { rollCall: { include: { bill: true } } },
  })
  if (!signal || signal.kind !== 'VOTE') throw new Error(`Signal ${signalId} not found or not a VOTE signal`)
  if (!signal.rollCall) throw new Error(`Signal ${signalId} has no RollCall`)

  const { rollCall } = signal
  const { bill } = rollCall

  // ── Fetch member votes ───────────────────────────────────────────────────
  await prisma.rollCall.update({ where: { id: rollCall.id }, data: { loadStatus: 'PENDING', loadError: null } })

  let memberVoteData = []
  try {
    // Try to find and fetch the actual roll-call vote data from Congress.gov
    memberVoteData = await fetchMemberVotes(rollCall, bill)

    // Persist MemberVote rows
    for (const { bioguideId, position } of memberVoteData) {
      await prisma.memberVote.upsert({
        where: { rollCallId_bioguideId: { rollCallId: rollCall.id, bioguideId } },
        create: { rollCallId: rollCall.id, bioguideId, position },
        update: { position },
      })
    }

    await prisma.rollCall.update({
      where: { id: rollCall.id },
      data: { loadStatus: 'LOADED', loadedAt: new Date(), loadError: null },
    })
  } catch (err) {
    await prisma.rollCall.update({
      where: { id: rollCall.id },
      data: { loadStatus: 'ERROR', loadError: err.message },
    })
    throw err
  }

  // ── Create Evidence for matched candidates ───────────────────────────────
  const candidates = await prisma.candidate.findMany({
    where: { bioguideId: { not: null } },
    select: { id: true, bioguideId: true, office: true },
  })

  // Map bioguideId → candidate for fast lookup
  const byBioguide = new Map(candidates.map(c => [c.bioguideId, c]))

  let evidenceCreated = 0
  for (const { bioguideId, position } of memberVoteData) {
    const candidate = byBioguide.get(bioguideId)
    if (!candidate) continue

    const stance = computeStance(position, signal.yesMeans)
    if (stance === null) continue // PRESENT / NOT_VOTING — no directional signal

    await prisma.evidence.upsert({
      where: { candidateId_questionId_signalId: { candidateId: candidate.id, questionId: signal.questionId, signalId: signal.id } },
      create: {
        candidateId: candidate.id,
        questionId: signal.questionId,
        signalId: signal.id,
        type: 'VOTE_RECORD',
        stance,
        confidence: 1.0, // vote records are deterministic
        rationale: `${position} on ${signal.title}`,
        reviewStatus: 'PUBLISHED',
        origin: 'AGENT',
      },
      update: { stance, rationale: `${position} on ${signal.title}` },
    })
    evidenceCreated++
  }

  return evidenceCreated
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** stance is deterministic from vote position + signal yesMeans */
function computeStance(position, yesMeans) {
  if (position === 'YES')  return yesMeans
  if (position === 'NO')   return 6 - yesMeans  // mirror on 1–5 scale
  return null // PRESENT or NOT_VOTING — abstention, exclude from grade
}

async function fetchMemberVotes(rollCall, bill) {
  // If we already have MemberVote rows and the rollCall is LOADED, return them
  if (rollCall.loadStatus === 'LOADED') {
    const existing = await prisma.memberVote.findMany({ where: { rollCallId: rollCall.id } })
    if (existing.length) return existing
  }

  // Look up roll number from Congress.gov actions
  const parsed = { type: bill.number.match(/^([a-z]+)/)?.[1], number: bill.number.replace(/^[a-z]+/, '') }
  if (!parsed.type || !parsed.number) throw new Error(`Cannot parse normalized bill number: ${bill.number}`)

  const rollCalls = await findRollCalls(bill.congress, parsed.type, parsed.number)
  if (!rollCalls.length) throw new Error(`No roll-call votes found for ${bill.number} (congress ${bill.congress})`)

  // Use the first passage vote found
  const rc = rollCalls[0]

  // Update RollCall with actual roll number
  await prisma.rollCall.update({
    where: { id: rollCall.id },
    data: { number: rc.rollNumber, date: rc.date },
  })

  const year = (rc.date ?? new Date()).getFullYear()

  if (bill.chamber === 'HOUSE') {
    return fetchHouseMemberVotes(year, rc.rollNumber)
  } else {
    return fetchSenateMemberVotes(bill.congress, rc.sessionNumber ?? 1, rc.rollNumber)
  }
}

async function ensureRollCall(bill, congress, type, number, chamber) {
  // Create a placeholder RollCall (roll number = 0) — filled in on load
  const existing = await prisma.rollCall.findFirst({ where: { billId: bill.id } })
  if (existing) return existing
  return prisma.rollCall.create({
    data: {
      billId: bill.id,
      congress,
      chamber,
      number: 0, // placeholder; updated when votes are fetched
      loadStatus: 'PENDING',
    },
  })
}
