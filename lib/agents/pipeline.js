import { runResearcher } from './researcher.js'
import { runAssessorFromFinding } from './assessor.js'
import { discoverAndLoadBill } from '../votes/loader.js'

/**
 * Full research pipeline for one candidate: Researcher → Assessor.
 * BILL_VOTE findings route to the vote pipeline (loads votes for ALL candidates at once).
 * Statement/custom findings route to the per-candidate assessor (legacy during P1→P2 transition).
 */
export async function runPipeline({ candidateId, questionIds, provider = 'minimax', dryRun = false }) {
  const research = await runResearcher({ candidateId, questionIds, provider, dryRun })
  if (dryRun) return { dryRun: true, ...research }

  const { findings: rawFindings } = research

  // Deduplicate by indicatorName — same bill/statement must not be scored twice
  // under different questions. Keep the highest-confidence copy.
  const deduped = new Map()
  for (const f of rawFindings) {
    const existing = deduped.get(f.indicatorName)
    if (!existing || f.confidence > existing.confidence) deduped.set(f.indicatorName, f)
  }
  const findings = [...deduped.values()]

  const assessed = []
  const errors = []

  for (const finding of findings) {
    try {
      if (finding.type === 'BILL_VOTE' && finding.meta?.billId) {
        // Bill votes are chamber-shared signals — load votes for ALL candidates at once.
        // discoverAndLoadBill is idempotent: safe to call multiple times for the same bill.
        const result = await discoverAndLoadBill({ questionId: finding.questionId, meta: finding.meta })
        assessed.push({
          indicatorName: finding.indicatorName,
          type: finding.type,
          evidenceCreated: result.evidenceCreated ?? 0,
        })
      } else {
        // Statement/custom findings — per-candidate assessor (legacy during transition to P2)
        const result = await runAssessorFromFinding({ candidateId, finding, provider })
        assessed.push({
          indicatorName: finding.indicatorName,
          type: finding.type,
          value: result.assessment.value,
          confidence: result.confidence,
        })
      }
    } catch (err) {
      errors.push({ indicatorName: finding.indicatorName, error: err.message })
    }
  }

  return {
    findings: findings.length,
    assessed: assessed.length,
    assessments: assessed,
    errors,
    searchCount: research.searchCount,
    cacheHitCount: research.cacheHitCount,
  }
}
