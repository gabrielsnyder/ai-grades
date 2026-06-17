/**
 * One-time migration: parse existing BILL_VOTE Indicator/Assessment records
 * and import them into the new Signal/Bill/RollCall/Evidence pipeline.
 *
 * For each unique bill found in the legacy Indicator table:
 *   1. Infer yesMeans from existing assessment value + votePosition in indicator meta
 *   2. Call discoverAndLoadBill to upsert Signal/Bill/RollCall and fetch actual votes
 *      from Congress.gov (creates Evidence rows for candidates with bioguideId set)
 *
 * Usage:
 *   node scripts/migrate-bill-votes-to-signals.mjs           # dry-run (show what would happen)
 *   node scripts/migrate-bill-votes-to-signals.mjs --run     # actually migrate
 */

import pkg from '../lib/db.js'
import { discoverAndLoadBill } from '../lib/votes/loader.js'
import { parseBillId, normalizeBillNumber } from '../lib/votes/congress.js'
const { prisma } = pkg

const dryRun = !process.argv.includes('--run')

if (dryRun) {
  console.log('DRY RUN — pass --run to actually migrate\n')
}

// ── Load all BILL_VOTE indicators with their assessments ──────────────────────

const billVoteIndicators = await prisma.indicator.findMany({
  where: { type: 'BILL_VOTE' },
  include: {
    question: { select: { id: true, text: true } },
    assessments: {
      select: { value: true, candidateId: true },
      where: { value: { not: null } },
    },
  },
  orderBy: { question: { order: 'asc' } },
})

console.log(`Found ${billVoteIndicators.length} BILL_VOTE indicator(s) in legacy system\n`)

if (billVoteIndicators.length === 0) {
  console.log('Nothing to migrate.')
  await prisma.$disconnect()
  process.exit(0)
}

// ── Deduplicate: one entry per (billId, congress, questionId) ─────────────────
// Multiple indicators can exist for the same bill if they were created at
// different times or under different names. We group by meta.billId + congress.

const billMap = new Map() // key: `${congress}:${billId}` → { indicator, yesMeans }

for (const ind of billVoteIndicators) {
  const meta = ind.meta ?? {}
  const billId = meta.billId
  if (!billId) {
    console.warn(`  SKIP: indicator "${ind.name}" (${ind.id}) has no meta.billId`)
    continue
  }

  const congress = meta.congress ?? 119
  const key = `${congress}:${billId}:${ind.questionId}`

  if (billMap.has(key)) {
    // Keep the one with more assessments (more signal data)
    const existing = billMap.get(key)
    if (ind.assessments.length > existing.indicator.assessments.length) {
      billMap.set(key, buildEntry(ind, meta, congress, billId))
    }
    continue
  }

  billMap.set(key, buildEntry(ind, meta, congress, billId))
}

function buildEntry(ind, meta, congress, billId) {
  const yesMeans = inferYesMeans(meta, ind.assessments)
  return { indicator: ind, meta, congress, billId, yesMeans }
}

/**
 * Infer yesMeans (1–5 scale) from existing assessment data.
 *
 * Strategy:
 * - If meta.yesMeans is already set, use it (researcher wrote it explicitly).
 * - If indicator meta has votePosition=YES and any assessment has a value,
 *   that assessment's value IS the yesMeans (YES vote → that stance).
 * - If votePosition=NO and assessment has value X, then yesMeans = 6 - X.
 * - Fall back to 3 (neutral) if we can't determine it.
 */
function inferYesMeans(meta, assessments) {
  if (meta.yesMeans != null) return meta.yesMeans

  const assessmentValues = assessments.map(a => a.value).filter(v => v != null)
  if (!assessmentValues.length) return 3 // neutral default

  // Use median assessment value to avoid outliers
  assessmentValues.sort((a, b) => a - b)
  const median = assessmentValues[Math.floor(assessmentValues.length / 2)]

  const votePosition = meta.votePosition
  if (votePosition === 'YES') return median
  if (votePosition === 'NO')  return 6 - median

  // votePosition unknown — assume this is a YES-positive bill (most common case)
  return median
}

// ── Print plan and execute ────────────────────────────────────────────────────

const entries = [...billMap.values()]
console.log(`Unique bills to migrate: ${entries.length}\n`)

let migrated = 0
let skipped = 0
let failed = 0

for (const { indicator: ind, meta, congress, billId, yesMeans } of entries) {
  const qShort = ind.question.text.slice(0, 60)
  const existingAssessments = ind.assessments.length
  const votePos = meta.votePosition ?? '?'

  console.log(`  ${billId} (${congress}th)`)
  console.log(`    Question : Q — ${qShort}`)
  console.log(`    yesMeans : ${yesMeans} (inferred from ${existingAssessments} assessment(s), votePosition=${votePos})`)

  // Check if a Signal already exists for this bill+question (don't duplicate)
  const parsed = parseBillId(billId)
  const normalizedNum = parsed ? normalizeBillNumber(parsed.type, parsed.number) : null
  const existingSignal = normalizedNum ? await prisma.signal.findFirst({
    where: {
      kind: 'VOTE',
      questionId: ind.question.id,
      rollCall: { bill: { congress, number: normalizedNum } },
    },
  }) : null
  if (existingSignal) {
    console.log(`    → ALREADY EXISTS (signal ${existingSignal.id}), skipping\n`)
    skipped++
    continue
  }
  if (!parsed) {
    console.warn(`    → SKIP: cannot parse bill ID "${billId}"\n`)
    skipped++
    continue
  }

  if (dryRun) {
    console.log(`    → would call discoverAndLoadBill\n`)
    migrated++
    continue
  }

  try {
    const result = await discoverAndLoadBill({
      questionId: ind.question.id,
      meta: {
        billId,
        billTitle: meta.billTitle ?? billId,
        congress,
        votePosition: meta.votePosition,
        yesMeans,
      },
    })
    console.log(`    → signal ${result.signalId}, evidenceCreated: ${result.evidenceCreated}\n`)
    migrated++
  } catch (err) {
    console.error(`    → ERROR: ${err.message}\n`)
    failed++
  }
}

console.log('─'.repeat(50))
console.log(`Migrated : ${migrated}`)
console.log(`Skipped  : ${skipped} (already in new system)`)
console.log(`Failed   : ${failed}`)
if (dryRun) console.log('\nRe-run with --run to apply.')

await prisma.$disconnect()
