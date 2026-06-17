import pkg from '../lib/db.js'
const { prisma } = pkg

// One-time migration: promote UNVERIFIED agent assessments to MACHINE_VERIFIED
// so they appear on the public scorecard.
// Filter to a specific candidate name with: NODE_OPTIONS=... node scripts/promote-unverified-assessments.mjs "Ocasio"

const nameFilter = process.argv[2] ?? null

const where = {
  reviewStatus: 'UNVERIFIED',
  origin: 'AGENT',
  ...(nameFilter ? { candidate: { name: { contains: nameFilter } } } : {}),
}

const count = await prisma.assessment.count({ where })
console.log(`Found ${count} UNVERIFIED agent assessment(s)${nameFilter ? ` matching "${nameFilter}"` : ''}`)

if (count === 0) {
  console.log('Nothing to do.')
  await prisma.$disconnect()
  process.exit(0)
}

const { count: updated } = await prisma.assessment.updateMany({
  where,
  data: { reviewStatus: 'MACHINE_VERIFIED' },
})

console.log(`Promoted ${updated} assessment(s) to MACHINE_VERIFIED`)
await prisma.$disconnect()
