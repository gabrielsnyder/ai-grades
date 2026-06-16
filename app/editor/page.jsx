export const dynamic = 'force-dynamic'

import { prisma } from '../../lib/db'
import EditorWeightsView from '../../components/EditorWeightsView'

async function getData() {
  const [questions, candidates, activeProfile] = await Promise.all([
    prisma.question.findMany({ orderBy: { order: 'asc' } }),
    prisma.candidate.findMany({
      include: {
        assessments: {
          include: { indicator: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.weightingProfile.findFirst({
      where: { isActive: true },
      include: { typeWeights: true },
    }),
  ])

  const typeWeights = {}
  if (activeProfile) {
    for (const tw of activeProfile.typeWeights) typeWeights[tw.type] = tw.weight
  }

  // Build raw data needed for client-side live recomputation
  const candidatesRaw = candidates.map((c) => ({
    id: c.id,
    name: c.name,
    state: c.state,
    party: c.party,
    perQuestion: questions.map((q) => ({
      questionId: q.id,
      questionText: q.text,
      assessments: c.assessments
        .filter(a => a.indicator.questionId === q.id)
        .map(a => ({
          type: a.indicator.type,
          value: a.value,
          wOverride: a.weightOverride,
          iWeight: a.indicator.weight,
        })),
    })),
  }))

  return { candidatesRaw, questions, typeWeights }
}

export default async function EditorPage() {
  const { candidatesRaw, questions, typeWeights } = await getData()
  return (
    <EditorWeightsView
      candidatesRaw={candidatesRaw}
      questions={questions}
      initialTypeWeights={typeWeights}
    />
  )
}
