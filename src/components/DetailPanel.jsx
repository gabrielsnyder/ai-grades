import { QUESTIONS } from '../data/senators'
import ScoreChip from './ScoreChip'

export default function DetailPanel({ senator }) {
  return (
    <tr className="detail-row">
      <td colSpan={9}>
        <div className="detail-panel">
          <div className="detail-grid">
            {senator.scores.map((s, qIdx) => (
              <div key={qIdx} className="detail-card">
                <div className="detail-card-header">
                  <ScoreChip score={s.score} style={{ cursor: 'default' }} />
                  <span className="detail-q-label">Q{qIdx + 1}: {QUESTIONS[qIdx]}</span>
                </div>
                <p className="detail-evidence">
                  {s.evidence || <em className="no-position">No publicly stated position found.</em>}
                </p>
                {s.url ? (
                  <div className="detail-source">
                    Source:{' '}
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.source}
                    </a>
                  </div>
                ) : s.source ? (
                  <div className="detail-source">Source: {s.source}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  )
}
