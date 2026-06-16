'use client'

import { scoreClass } from '../lib/scoring'

export default function ScoreChip({ score, onClick, className = '' }) {
  const cls = scoreClass(score)
  const label = score === null ? '–' : score % 1 === 0 ? score : score.toFixed(1)

  return (
    <span
      className={`score-chip ${cls} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick(e) : undefined}
    >
      {label}
    </span>
  )
}
