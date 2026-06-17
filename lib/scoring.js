import { SCORE_THRESHOLDS, EVIDENCE_TO_INDICATOR_TYPE, PUBLISHED_STATUSES } from './constants.js'

// ── Evidence grading (new model) ──────────────────────────────────────────────

// Resolve the effective type weight for one Evidence item.
// TypeWeight still uses IndicatorType during P3 transition; maps across via constants.
export function resolveEvidenceWeight(evidence, typeWeights) {
  const indicatorType = EVIDENCE_TO_INDICATOR_TYPE[evidence.type] ?? 'CUSTOM'
  return typeWeights?.[indicatorType] ?? 1.0
}

// Compute the question grade from an array of Evidence items.
// Only items with a non-null stance contribute.
// typeWeights: plain object { BILL_VOTE: 1.5, PUBLIC_STATEMENT: 1.0, ... }
export function questionGrade(evidenceItems, typeWeights = {}) {
  const active = evidenceItems.filter(e => e.stance != null)
  if (!active.length) return null
  const totalWeight = active.reduce((sum, e) => sum + resolveEvidenceWeight(e, typeWeights), 0)
  if (totalWeight === 0) return null
  return active.reduce((sum, e) => sum + e.stance * resolveEvidenceWeight(e, typeWeights), 0) / totalWeight
}

// Filter Evidence to only publishable items (used by public scorecard).
export function publishableEvidence(evidenceItems) {
  return evidenceItems.filter(e => PUBLISHED_STATUSES.includes(e.reviewStatus))
}

// ── Overall grade ─────────────────────────────────────────────────────────────

// Average of non-null question grades (same semantics as before).
export function overallGrade(questionGrades) {
  const vals = questionGrades.filter(v => v !== null)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

// ── Score display (single source via SCORE_THRESHOLDS) ────────────────────────

export function scoreLabel(avg) {
  if (avg === null || avg === undefined) return 'No data'
  return SCORE_THRESHOLDS.find(t => avg < t.max)?.label ?? 'AI Booster'
}

export function scoreColor(avg) {
  if (avg === null || avg === undefined) return '#bdc3c7'
  return SCORE_THRESHOLDS.find(t => avg < t.max)?.color ?? '#1a6b3a'
}

export function scoreClass(avg) {
  if (avg === null || avg === undefined) return 'snull'
  const idx = SCORE_THRESHOLDS.findIndex(t => avg < t.max)
  return `s${idx + 1}`
}

// ── Legacy Assessment grading (kept for transition until P4) ──────────────────

export function weightedScore(items) {
  const active = items.filter(c => c.value !== null && c.value !== undefined)
  if (!active.length) return null
  const totalWeight = active.reduce((sum, c) => sum + c.weight, 0)
  if (totalWeight === 0) return null
  return active.reduce((sum, c) => sum + c.value * c.weight, 0) / totalWeight
}

export function resolveWeight(assessment, typeWeights) {
  if (assessment.weightOverride != null) return assessment.weightOverride
  if (assessment.indicator?.weight != null) return assessment.indicator.weight
  const tw = typeWeights?.[assessment.indicator?.type]
  if (tw != null) return tw
  return 1.0
}

// Kept as alias during transition; prefer overallGrade going forward.
export const overallScore = overallGrade

// ── Type labels ───────────────────────────────────────────────────────────────

export function evidenceTypeLabel(type) {
  const map = {
    VOTE_RECORD:        'Vote Record',
    STATEMENT:          'Statement',
    CAMPAIGN_STATEMENT: 'Campaign Statement',
    ARTICLE:            'Article',
    CUSTOM:             'Custom',
  }
  return map[type] ?? type
}

export function indicatorTypeLabel(type) {
  const map = {
    BILL_VOTE:          'Bill Vote',
    PUBLIC_STATEMENT:   'Public Statement',
    CAMPAIGN_STATEMENT: 'Campaign Statement',
    CUSTOM:             'Custom',
  }
  return map[type] ?? type
}

// Legacy alias
export const componentTypeLabel = indicatorTypeLabel
