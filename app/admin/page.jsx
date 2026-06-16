export const dynamic = 'force-dynamic'

import { prisma } from '../../lib/db'
import AdminDashboard from '../../components/AdminDashboard'

async function getData() {
  const [users, questions, groups, candidateCount] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, email: true, role: true, createdAt: true } }),
    prisma.question.findMany({ orderBy: { order: 'asc' } }),
    prisma.candidateGroup.findMany({ include: { candidates: { select: { id: true, name: true, state: true, party: true } } } }),
    prisma.candidate.count(),
  ])
  return { users, questions, groups, candidateCount }
}

export default async function AdminPage() {
  const data = await getData()
  return <AdminDashboard {...data} />
}
