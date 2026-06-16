import { runResearcher } from './researcher.js'
import { runAssessorFromFinding } from './assessor.js'

/**
 * Full research pipeline for one candidate: Researcher → Assessor.
 * The researcher discovers typed evidence; the assessor findOrCreates
 * Indicators and scores each finding.
 */
export async function runPipeline({ candidateId, questionIds, provider = 'minimax', dryRun = false }) {
  const research = await runResearcher({ candidateId, questionIds, provider, dryRun })
  if (dryRun) return { dryRun: true, ...research }

  const { findings } = research
  const assessed = []
  const errors = []

  for (const finding of findings) {
    try {
      const result = await runAssessorFromFinding({ candidateId, finding, provider })
      assessed.push({
        indicatorName: finding.indicatorName,
        type: finding.type,
        value: result.assessment.value,
        confidence: result.confidence,
      })
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
