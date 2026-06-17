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

  // BILL_VOTE indicators are global signals shown for all relevant candidates.
  // Statement/custom indicators are candidate-scoped: only show them when this
  // candidate actually has an assessment (avoids cluttering with every other
  // candidate's statement indicators).
  const indicatorData = questions.flatMap((q) =>
    q.indicators
      .filter((ind) => {
        if (ind.type === 'BILL_VOTE') return true
        return candidate.assessments.some(a => a.indicatorId === ind.id)
      })
      .map((ind) => {
        const assessment = candidate.assessments.find(a => a.indicatorId === ind.id)
        const sources = assessment
          ? assessment.sources.map(as => as.source)
          : []
        // Strip the candidateId:: prefix added by the pipeline for scoped indicators
        const displayName = ind.name.includes('::') ? ind.name.split('::').slice(1).join('::') : ind.name
        return {
          question: q,
          indicator: { ...ind, name: displayName },
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
