export const dynamic = 'force-dynamic'

import { prisma } from '../../../../lib/db'
import { resolveWeight, weightedScore } from '../../../../lib/scoring'
import CandidateEditor from '../../../../components/CandidateEditor'
import { notFound } from 'next/navigation'

async function getData(id) {
  const [candidate, questions, activeProfile] = await Promise.all([
    prisma.candidate.findUnique({
      where: { id },
      include: {
        assessments: {
          include: {
            indicator: true,
            sources: { include: { source: true } },
          },
        },
      },
    }),
    prisma.question.findMany({
      orderBy: { order: 'asc' },
      include: { indicators: true },
    }),
    prisma.weightingProfile.findFirst({
      where: { isActive: true },
      include: { typeWeights: true },
    }),
  ])

  if (!candidate) return null

  const typeWeights = {}
  if (activeProfile) {
    for (const tw of activeProfile.typeWeights) typeWeights[tw.type] = tw.weight
  }

  const indicatorData = questions.flatMap((q) =>
    q.indicators.map((ind) => {
      const assessment = candidate.assessments.find(a => a.indicatorId === ind.id)
      const sources = assessment
        ? assessment.sources.map(as => as.source)
        : []
      return {
        question: q,
        indicator: ind,
        assessmentId: assessment?.id ?? null,
        value: assessment?.value ?? null,
        rationale: assessment?.rationale ?? '',
        reviewStatus: assessment?.reviewStatus ?? 'UNVERIFIED',
        sources,
        computed: assessment?.value ?? null,
      }
    })
  )

  return { candidate, indicatorData }
}

export default async function CandidateEditorPage({ params }) {
  const data = await getData(params.id)
  if (!data) notFound()

  return <CandidateEditor candidate={data.candidate} indicatorData={data.indicatorData} />
}
