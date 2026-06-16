import { prisma } from '../../../../../lib/db.js'
import { runPipeline } from '../../../../../lib/agents/pipeline.js'

function send(controller, encoder, data) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
}

export async function POST(request) {
  const { batchSize = 20, office } = await request.json()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Candidates with no sources yet = never researched
        const where = {
          sources: { none: {} },
          ...(office === 'S' ? { office: { endsWith: ' Sen' } } : {}),
          ...(office === 'H' ? { NOT: { office: { endsWith: ' Sen' } } } : {}),
        }

        const candidates = await prisma.candidate.findMany({
          where,
          select: { id: true, name: true, office: true, state: true },
          orderBy: { name: 'asc' },
          take: batchSize,
        })

        send(controller, encoder, { type: 'start', total: candidates.length })

        let totalFindings = 0
        let totalAssessed = 0
        let totalErrors = 0

        for (let i = 0; i < candidates.length; i++) {
          const c = candidates[i]
          send(controller, encoder, {
            type: 'progress',
            current: i + 1,
            total: candidates.length,
            name: c.name,
            office: c.office,
          })

          try {
            const result = await runPipeline({ candidateId: c.id })
            totalFindings += result.findings ?? 0
            totalAssessed += result.assessed ?? 0
            totalErrors += result.errors?.length ?? 0
            send(controller, encoder, {
              type: 'candidate_done',
              name: c.name,
              findings: result.findings,
              assessed: result.assessed,
              errors: result.errors?.length ?? 0,
            })
          } catch (e) {
            totalErrors++
            send(controller, encoder, {
              type: 'candidate_error',
              name: c.name,
              error: e.message,
            })
          }
        }

        send(controller, encoder, {
          type: 'complete',
          total: candidates.length,
          totalFindings,
          totalAssessed,
          totalErrors,
        })
      } catch (e) {
        send(controller, encoder, { type: 'error', error: e.message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
