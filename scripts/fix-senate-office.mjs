import { prisma } from '../lib/db.js'

const senators = await prisma.candidate.findMany({
  where: { office: 'Senate' },
  select: { id: true, name: true, state: true },
})

console.log(`Found ${senators.length} candidates with office='Senate'`)

for (const s of senators) {
  const newOffice = `${s.state} Sen`
  await prisma.candidate.update({
    where: { id: s.id },
    data: { office: newOffice },
  })
  console.log(`  ${s.name}: Senate → ${newOffice}`)
}

console.log('Done')
await prisma.$disconnect()
