'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import ScoreChip from './ScoreChip'
import { scoreLabel, scoreColor, indicatorTypeLabel } from '../lib/scoring'

const STATUS_STYLE = {
  UNVERIFIED:      { background: '#f5f5f5', color: '#666' },
  MACHINE_VERIFIED:{ background: '#e8f5e9', color: '#2e7d32' },
  AUTO_CORRECTED:  { background: '#e3f2fd', color: '#1565c0' },
  FLAGGED:         { background: '#fff3e0', color: '#e65100' },
  HUMAN_REVIEWED:  { background: '#f3e5f5', color: '#6a1b9a' },
}

function AssessmentForm({ initial, onSave, onCancel }) {
  const [value, setValue] = useState(initial?.value?.toString() ?? '')
  const [rationale, setRationale] = useState(initial?.rationale ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    const val = value === '' ? null : parseInt(value, 10)
    if (val !== null && (isNaN(val) || val < 1 || val > 5)) {
      alert('Score must be between 1 and 5')
      return
    }
    setSaving(true)
    await onSave({ value: val, rationale: rationale || null })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSave} style={{ padding: '12px 4px' }}>
      <div className="form-group">
        <label className="form-label">Score (1–5, blank = no position)</label>
        <input
          className="form-input"
          type="number"
          min="1"
          max="5"
          step="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ width: 80 }}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Rationale / Evidence</label>
        <textarea
          className="form-textarea"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={4}
          placeholder="Describe the basis for this score…"
        />
      </div>
      <div className="overlay-footer">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

export default function CandidateEditor({ candidate, indicatorData: initialData }) {
  const [indicatorData, setIndicatorData] = useState(initialData)
  const [editing, setEditing] = useState(null)

  const handleSave = useCallback((idx) => async (payload) => {
    const item = indicatorData[idx]
    if (!item.assessmentId) return

    const res = await fetch(`/api/assessments/${item.assessmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return

    const updated = await res.json()
    setIndicatorData((prev) => prev.map((d, i) =>
      i === idx ? { ...d, value: updated.value, rationale: updated.rationale, reviewStatus: updated.reviewStatus, computed: updated.value } : d
    ))
    setEditing(null)
  }, [indicatorData])

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <Link href="/editor" style={{ fontSize: 13, color: '#1565C0', textDecoration: 'none' }}>← Candidates</Link>
          <h1 style={{ marginTop: 6 }}>{candidate.name}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 13, color: '#666' }}>{candidate.state}</span>
            <span className={`party-badge ${candidate.party}`}>{candidate.party}</span>
          </div>
        </div>
      </div>

      {indicatorData.map((item, idx) => {
        const isEditingHere = editing === idx
        const statusStyle = STATUS_STYLE[item.reviewStatus] ?? STATUS_STYLE.UNVERIFIED

        return (
          <div key={item.indicator.id} className="question-section">
            <div className="question-section-header">
              <div className="question-section-title">
                Q{idx + 1}: {item.question.text}
              </div>
              <div className="question-computed-score">
                <ScoreChip score={item.computed} className="static" />
                <span style={{ fontSize: 12, color: '#666' }}>
                  {item.computed !== null ? `${item.computed} · ${scoreLabel(item.computed)}` : 'No score'}
                </span>
              </div>
              <span
                style={{
                  ...statusStyle,
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontWeight: 600,
                  marginLeft: 8,
                }}
              >
                {item.reviewStatus.replace(/_/g, ' ')}
              </span>
              <button
                className="btn-ghost"
                style={{ fontSize: 12, padding: '4px 10px', marginLeft: 'auto' }}
                onClick={() => setEditing(isEditingHere ? null : idx)}
              >
                {isEditingHere ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {isEditingHere ? (
              <AssessmentForm
                initial={item}
                onSave={handleSave(idx)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="component-list">
                {item.rationale ? (
                  <div className="component-item" style={{ display: 'block' }}>
                    <p className="component-notes" style={{ margin: 0 }}>{item.rationale}</p>
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '16px 20px' }}>
                    No rationale recorded. Click Edit to add one.
                  </div>
                )}

                {item.sources.filter(s => s.url || s.title).map((source) => (
                  <div key={source.id} className="component-source" style={{ padding: '6px 20px' }}>
                    {source.url ? (
                      <a href={source.url} target="_blank" rel="noopener noreferrer">
                        ↗ {source.title || source.url}
                      </a>
                    ) : (
                      source.title
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
