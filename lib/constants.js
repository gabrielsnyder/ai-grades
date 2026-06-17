// ── ReviewStatus ──────────────────────────────────────────────────────────────

// Evidence statuses that contribute to the public grade.
export const PUBLISHED_STATUSES = ['PUBLISHED', 'HUMAN_REVIEWED']

// Evidence statuses that the agent pipeline may overwrite.
export const AGENT_WRITABLE_STATUSES = ['DRAFT', 'FLAGGED']

// ── Score thresholds ──────────────────────────────────────────────────────────

// Single source of truth for label/color/class breakpoints (1–5 scale).
export const SCORE_THRESHOLDS = [
  { max: 1.8,      label: 'AI Skeptic',    color: '#c0392b', cls: 's1' },
  { max: 2.6,      label: 'Lean Skeptic',  color: '#d4700a', cls: 's2' },
  { max: 3.4,      label: 'Mixed',         color: '#b8960a', cls: 's3' },
  { max: 4.2,      label: 'Lean Booster',  color: '#27ae60', cls: 's4' },
  { max: Infinity, label: 'AI Booster',    color: '#1a6b3a', cls: 's5' },
]

// ── EvidenceType ──────────────────────────────────────────────────────────────

export const EVIDENCE_TYPE_LABELS = {
  VOTE_RECORD:        'Vote Record',
  STATEMENT:          'Statement',
  CAMPAIGN_STATEMENT: 'Campaign Statement',
  ARTICLE:            'Article',
  CUSTOM:             'Custom',
}

// Maps EvidenceType → IndicatorType for TypeWeight lookups during the P3 transition
// period when TypeWeight.type still uses the legacy IndicatorType enum.
export const EVIDENCE_TO_INDICATOR_TYPE = {
  VOTE_RECORD:        'BILL_VOTE',
  STATEMENT:          'PUBLIC_STATEMENT',
  CAMPAIGN_STATEMENT: 'CAMPAIGN_STATEMENT',
  ARTICLE:            'CUSTOM',
  CUSTOM:             'CUSTOM',
}

// ── Legacy IndicatorType labels (kept for Assessment display during transition) ─

export const INDICATOR_TYPE_LABELS = {
  BILL_VOTE:          'Bill Vote',
  PUBLIC_STATEMENT:   'Public Statement',
  CAMPAIGN_STATEMENT: 'Campaign Statement',
  CUSTOM:             'Custom',
}
