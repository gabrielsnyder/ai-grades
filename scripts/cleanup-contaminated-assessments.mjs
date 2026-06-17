import pkg from '../lib/db.js'
const { prisma } = pkg

// Remove assessments where the indicator name contains another candidate's name.
// This happens when the researcher picks up other legislators' statements from
// search results and incorrectly attributes them to the candidate being researched.
//
// Usage:
//   node scripts/cleanup-contaminated-assessments.mjs "Abraham Hamadeh"
//   node scripts/cleanup-contaminated-assessments.mjs  (dry run — prints without deleting)
//
// Pass --delete as a second arg to actually delete:
//   node scripts/cleanup-contaminated-assessments.mjs "Abraham Hamadeh" --delete

const candidateName = process.argv[2] ?? null
const shouldDelete = process.argv.includes('--delete')

const candidateWhere = candidateName
  ? { candidate: { name: { contains: candidateName } } }
  : {}

// Find assessments whose indicator name looks like it belongs to someone else:
// heuristic — indicator is a PUBLIC_STATEMENT/CUSTOM whose name doesn't start
// with the candidate's own first or last name
const candidates = await prisma.candidate.findMany({
  where: candidateName ? { name: { contains: candidateName } } : {},
  include: {
    assessments: {
      include: { indicator: true },
    },
  },
})

let totalFound = 0
const toDelete = []

for (const c of candidates) {
  const nameParts = c.name.toLowerCase().split(/\s+/)
  for (const a of c.assessments) {
    const ind = a.indicator
    if (ind.type === 'BILL_VOTE') continue // bill votes are always shared, skip

    const indNameLower = ind.name.toLowerCase()
    // Flag if indicator name doesn't reference this candidate at all
    const belongsToCandidate = nameParts.some(part => part.length > 2 && indNameLower.includes(part))
    if (!belongsToCandidate) {
      totalFound++
      toDelete.push({ candidateName: c.name, indicatorName: ind.name, assessmentId: a.id })
      console.log(`  [${c.name}] contaminated: "${ind.name}"`)
    }
  }
}

console.log(`\nFound ${totalFound} potentially contaminated assessment(s).`)

if (totalFound === 0 || !shouldDelete) {
  if (!shouldDelete && totalFound > 0) {
    console.log('Re-run with --delete to remove them.')
  }
  await prisma.$disconnect()
  process.exit(0)
}

const ids = toDelete.map(r => r.assessmentId)
const { count } = await prisma.assessment.deleteMany({ where: { id: { in: ids } } })
console.log(`Deleted ${count} contaminated assessment(s).`)

await prisma.$disconnect()
