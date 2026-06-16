'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ScoreChip from './ScoreChip'
import { scoreLabel, indicatorTypeLabel } from '../lib/scoring'

const SEVERITY_STYLE = {
  HIGH:   { background: '#fdecea', color: '#c62828', border: '1px solid #ef9a9a' },
  MEDIUM: { background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' },
  LOW:    { background: '#f9f9f9', color: '#555',    border: '1px solid #ddd' },
}

function FlagItem({ item, onResolved }) {
  const [correcting, setCorrecting] = useState(false)
  const [editValue, setEditValue] = useState(item.value?.toString() ?? '')
  const [editRationale, setEditRationale] = useState(item.rationale ?? '')
  const [busy, setBusy] = useState(false)

  async function resolve(action, extra = {}) {
    setBusy(true)
    try {
      const res = await fetch(`/api/assessments/${item.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      if (res.ok) onResolved(item.id)
    } finally {
      setBusy(false)
    }
  }

  const severityStyle = SEVERITY_STYLE[item.flags[0]?.severity?.toUpperCase()] ?? SEVERITY_STYLE.LOW

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ padding: '14px 16px 0' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{item.candidate.name}</span>
          <span style={{ fontSize: 12, color: '#666' }}>{item.candidate.state}</span>
          <span className={`party-badge ${item.candidate.party}`}>{item.candidate.party}</span>
          <span style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>
            Q{item.question.order + 1}: {item.question.text}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, background: '#f5f5f5', color: '#666', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
            {indicatorTypeLabel(item.indicator.type)}
          </span>
        </div>

        {/* Current score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <ScoreChip score={item.value} className="static" />
          <span style={{ fontSize: 13, color: '#555' }}>
            {item.value !== null ? scoreLabel(item.value) : 'No score'}
          </span>
        </div>

        {/* Flag reasons */}
        {item.flags.map((flag, i) => (
          <div key={i} style={{ ...severityStyle, borderRadius: 6, padding: '8px 12px', marginBottom: 8, fontSize: 13 }}>
            <span style={{ fontWeight: 700, marginRight: 6 }}>{flag.severity}</span>
            {flag.reason}
            {flag.confidence != null && (
              <span style={{ marginLeft: 8, opacity: 0.7, fontSize: 11 }}>
                ({(flag.confidence * 100).toFixed(0)}% confidence)
              </span>
            )}
          </div>
        ))}

        {/* Rationale */}
        {item.rationale && (
          <p style={{ fontSize: 13, color: '#333', marginBottom: 8, lineHeight: 1.5 }}>{item.rationale}</p>
        )}

        {/* Sources */}
        {item.sources.filter(s => s.url || s.title).map((s, i) => (
          <div key={i} style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
            {s.url
              ? <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1565C0' }}>↗ {s.title || s.url}</a>
              : s.title}
          </div>
        ))}
      </div>

      {/* Correct form */}
      {correcting && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid #edf0f3', background: '#f9fbfc' }}>
          <div className="form-group">
            <label className="form-label">Corrected score (1–5, blank = no position)</label>
            <input
              className="form-input"
              type="number"
              min="1"
              max="5"
              step="1"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              style={{ width: 80 }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Corrected rationale</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={editRationale}
              onChange={(e) => setEditRationale(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => resolve('correct', {
                value: editValue === '' ? null : parseInt(editValue, 10),
                rationale: editRationale || null,
              })}
            >
              {busy ? 'Saving…' : 'Save & mark reviewed'}
            </button>
            <button className="btn-ghost" onClick={() => setCorrecting(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Action row */}
      {!correcting && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderTop: '1px solid #edf0f3' }}>
          <button
            className="btn-primary"
            style={{ fontSize: 12, padding: '5px 12px' }}
            disabled={busy}
            onClick={() => resolve('confirm')}
          >
            {busy ? '…' : 'Confirm correct'}
          </button>
          <button
            className="btn-ghost"
            style={{ fontSize: 12, padding: '5px 12px' }}
            disabled={busy}
            onClick={() => setCorrecting(true)}
          >
            Correct
          </button>
          <button
            className="btn-ghost"
            style={{ fontSize: 12, padding: '5px 12px', marginLeft: 'auto', color: '#888' }}
            disabled={busy}
            onClick={() => resolve('dismiss')}
          >
            Dismiss flag
          </button>
        </div>
      )}
    </div>
  )
}

export default function FlagQueue({ items: initial }) {
  const router = useRouter()
  const [items, setItems] = useState(initial)

  const handleResolved = useCallback((id) => {
    setItems(prev => prev.filter(i => i.id !== id))
    router.refresh()
  }, [router])

  if (items.length === 0) {
    return (
      <div className="card">
        <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
          All caught up — no flagged items remaining.
        </div>
      </div>
    )
  }

  return (
    <div>
      {items.map(item => (
        <FlagItem key={item.id} item={item} onResolved={handleResolved} />
      ))}
    </div>
  )
}
