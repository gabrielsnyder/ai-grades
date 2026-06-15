import { scoreClass } from '../data/senators'

export default function ScoreChip({ score, onClick, style = {} }) {
  const cls = scoreClass(score)
  const label = score === null ? '–' : score

  return (
    <span
      className={`score-chip ${cls}`}
      onClick={onClick}
      style={style}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick(e) : undefined}
    >
      {label}
    </span>
  )
}
