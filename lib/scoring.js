// Compute weighted average from [{value, weight}] pairs
export function weightedScore(items) {
  const active = items.filter(c => c.value !== null && c.value !== undefined)
  if (!active.length) return null
  const totalWeight = active.reduce((sum, c) => sum + c.weight, 0)
  if (totalWeight === 0) return null
  return active.reduce((sum, c) => sum + c.value * c.weight, 0) / totalWeight
}

// Resolve effective weight for one assessment.
// typeWeights is a plain object: { BILL_VOTE: 1.5, CUSTOM: 1.0, ... }
export function resolveWeight(assessment, typeWeights) {
  if (assessment.weightOverride != null) return assessment.weightOverride
  if (assessment.indicator?.weight != null) return assessment.indicator.weight
  const tw = typeWeights?.[assessment.indicator?.type]
  if (tw != null) return tw
  return 1.0
}

export function overallScore(questionScores) {
  const vals = questionScores.filter(v => v !== null)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function scoreLabel(avg) {
  if (avg === null) return 'No data'
  if (avg < 1.8) return 'AI Skeptic'
  if (avg < 2.6) return 'Lean Skeptic'
  if (avg < 3.4) return 'Mixed'
  if (avg < 4.2) return 'Lean Booster'
  return 'AI Booster'
}

export function scoreClass(s) {
  if (s === null) return 'snull'
  if (s <= 1) return 's1'
  if (s <= 2) return 's2'
  if (s <= 3) return 's3'
  if (s <= 4) return 's4'
  return 's5'
}

export function scoreColor(s) {
  if (s === null) return '#bdc3c7'
  if (s < 1.8) return '#c0392b'
  if (s < 2.6) return '#d4700a'
  if (s < 3.4) return '#b8960a'
  if (s < 4.2) return '#27ae60'
  return '#1a6b3a'
}

export function indicatorTypeLabel(type) {
  const map = {
    BILL_VOTE: 'Bill Vote',
    PUBLIC_STATEMENT: 'Public Statement',
    CAMPAIGN_STATEMENT: 'Campaign Statement',
    CUSTOM: 'Custom',
  }
  return map[type] ?? type
}

// Legacy alias kept during transition
export const componentTypeLabel = indicatorTypeLabel
