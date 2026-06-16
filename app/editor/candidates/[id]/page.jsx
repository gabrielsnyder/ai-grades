export const dynamic = 'force-dynamic'

import { prisma } from '../../../../lib/db'
import { weightedScore } from '../../../../lib/scoring'
import CandidateEditor from '../../../../components/CandidateEditor'
import { notFound } from 'next/navigation'

async function getData(id) {
  const [candidate, questions] = await Promise.all([
    prisma.candidate.findUnique({
      where: { id },
      include: {
        scores: {
          include: { components: true, question: true },
        },
      },
    }),
    prisma.question.findMany({ orderBy: { order: 'asc' } }),
  ])

  if (!candidate) return null

  const questionData = questions.map((q) => {
    const score = candidate.scores.find((s) => s.questionId === q.id)
    return {
      question: q,
      scoreId: score?.id ?? null,
      notes: score?.notes ?? '',
      components: score?.components ?? [],
      computed: score ? weightedScore(score.components) : null,
    }
  })

  return { candidate, questionData }
}

export default async function CandidateEditorPage({ params }) {
  const data = await getData(params.id)
  if (!data) notFound()

  return <CandidateEditor candidate={data.candidate} questionData={data.questionData} />
}
