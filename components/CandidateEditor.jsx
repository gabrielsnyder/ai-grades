'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import ScoreChip from './ScoreChip'
import { weightedScore, scoreLabel, scoreColor, componentTypeLabel } from '../lib/scoring'

const COMPONENT_TYPES = ['BILL_VOTE', 'PUBLIC_STATEMENT', 'CAMPAIGN_STATEMENT', 'CUSTOM']

const TYPE_BADGE = {
  BILL_VOTE: 'badge-bill',
  PUBLIC_STATEMENT: 'badge-public',
  CAMPAIGN_STATEMENT: 'badge-campaign',
  CUSTOM: 'badge-custom',
}

function ComponentForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    type: initial?.type ?? 'CUSTOM',
    value: initial?.value?.toString() ?? '',
    weight: initial?.weight?.toString() ?? '1',
    sourceUrl: initial?.sourceUrl ?? '',
    sourceLabel: initial?.sourceLabel ?? '',
    notes: initial?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSave(e) {
    e.preventDefault()
    const val = parseFloat(form.value)
    if (isNaN(val) || val < 1 || val > 5) {
      alert('Score value must be between 1 and 5')
      return
    }
    setSaving(true)
    await onSave({
      type: form.type,
      value: val,
      weight: parseFloat(form.weight) || 1,
      sourceUrl: form.sourceUrl || null,
      sourceLabel: form.sourceLabel || null,
      notes: form.notes || null,
    })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSave}>
      <div className="form-group">
        <label className="form-label">Type</label>
        <select className="form-select" value={form.type} onChange={(e) => update('type', e.target.value)}>
          {COMPONENT_TYPES.map((t) => (
            <option key={t} value={t}>{componentTypeLabel(t)}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Score (1–5)</label>
          <input
            className="form-input"
            type="number"
            min="1"
            max="5"
            step="0.5"
            value={form.value}
            onChange={(e) => update('value', e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Weight</label>
          <input
            className="form-input"
            type="number"
            min="0.1"
            step="0.1"
            value={form.weight}
            onChange={(e) => update('weight', e.target.value)}
          />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notes / Evidence</label>
        <textarea
          className="form-textarea"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Describe what this component is based on…"
        />
      </div>
      <div className="form-group">
        <label className="form-label">Source URL</label>
        <input
          className="form-input"
          type="url"
          value={form.sourceUrl}
          onChange={(e) => update('sourceUrl', e.target.value)}
          placeholder="https://..."
        />
      </div>
      <div className="form-group">
        <label className="form-label">Source Label</label>
        <input
          className="form-input"
          type="text"
          value={form.sourceLabel}
          onChange={(e) => update('sourceLabel', e.target.value)}
          placeholder="e.g. Senate press release"
        />
      </div>
      <div className="overlay-footer">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save component'}
        </button>
      </div>
    </form>
  )
}

function NotesEditor({ scoreId, questionId, candidateId, initialNotes }) {
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/scores/${scoreId ?? 'new'}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId, questionId, notes }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ padding: '8px 12px 12px', borderTop: '1px solid #edf0f3' }}>
      <label className="form-label" style={{ marginBottom: 6 }}>Evidence / Notes (displayed on public scorecard)</label>
      <textarea
        className="form-textarea"
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setSaved(false) }}
        rows={3}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
        {saved && <span style={{ fontSize: 12, color: '#27ae60', alignSelf: 'center' }}>Saved</span>}
        <button className="btn-ghost" onClick={save} disabled={saving} style={{ fontSize: 12, padding: '4px 12px' }}>
          {saving ? 'Saving…' : 'Save notes'}
        </button>
      </div>
    </div>
  )
}

export default function CandidateEditor({ candidate, questionData: initialData }) {
  const [questionData, setQuestionData] = useState(initialData)
  const [addingTo, setAddingTo] = useState(null)
  const [editingComponent, setEditingComponent] = useState(null)

  const refreshScore = useCallback(async (qIdx, scoreId) => {
    const res = await fetch(`/api/scores/${scoreId}/components`)
    if (!res.ok) return
    const components = await res.json()
    setQuestionData((prev) => prev.map((qd, i) => {
      if (i !== qIdx) return qd
      const computed = weightedScore(components)
      return { ...qd, components, computed }
    }))
  }, [])

  async function handleAddComponent(qIdx, qd) {
    return async (payload) => {
      let scoreId = qd.scoreId
      if (!scoreId) {
        const res = await fetch('/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidateId: candidate.id, questionId: qd.question.id }),
        })
        const data = await res.json()
        scoreId = data.id
        setQuestionData((prev) => prev.map((d, i) => i === qIdx ? { ...d, scoreId } : d))
      }

      await fetch(`/api/scores/${scoreId}/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await refreshScore(qIdx, scoreId)
      setAddingTo(null)
    }
  }

  async function handleEditComponent(qIdx, scoreId, componentId) {
    return async (payload) => {
      await fetch(`/api/scores/${scoreId}/components/${componentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await refreshScore(qIdx, scoreId)
      setEditingComponent(null)
    }
  }

  async function handleDeleteComponent(qIdx, scoreId, componentId) {
    if (!confirm('Delete this component?')) return
    await fetch(`/api/scores/${scoreId}/components/${componentId}`, { method: 'DELETE' })
    await refreshScore(qIdx, scoreId)
  }

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

      {questionData.map((qd, qIdx) => {
        const computed = weightedScore(qd.components)
        const isAddingHere = addingTo === qIdx
        const isEditing = editingComponent?.qIdx === qIdx

        return (
          <div key={qd.question.id} className="question-section">
            <div className="question-section-header">
              <div className="question-section-title">
                Q{qIdx + 1}: {qd.question.text}
              </div>
              <div className="question-computed-score">
                <ScoreChip score={computed} className="static" />
                <span style={{ fontSize: 12, color: '#666' }}>
                  {computed !== null ? `${computed.toFixed(2)} · ${scoreLabel(computed)}` : 'No score'}
                </span>
              </div>
              <button
                className="btn-ghost"
                style={{ fontSize: 12, padding: '4px 10px', marginLeft: 'auto' }}
                onClick={() => setAddingTo(isAddingHere ? null : qIdx)}
              >
                + Add component
              </button>
            </div>

            <div className="component-list">
              {qd.components.length === 0 && !isAddingHere && (
                <div className="empty-state" style={{ padding: '20px' }}>
                  No score components yet. Add one above.
                </div>
              )}
              {qd.components.map((comp) => {
                const isEditingThis = editingComponent?.componentId === comp.id
                return (
                  <div key={comp.id} className="component-item">
                    <ScoreChip score={comp.value} className="static" />
                    <div className="component-body">
                      {isEditingThis ? (
                        <ComponentForm
                          initial={comp}
                          onSave={handleEditComponent(qIdx, qd.scoreId, comp.id)}
                          onCancel={() => setEditingComponent(null)}
                        />
                      ) : (
                        <>
                          <div className="component-meta">
                            <span className={`badge ${TYPE_BADGE[comp.type]}`}>
                              {componentTypeLabel(comp.type)}
                            </span>
                            <span className="component-value" style={{ color: scoreColor(comp.value) }}>
                              {comp.value}
                            </span>
                            <span className="component-weight">× {comp.weight} weight</span>
                          </div>
                          {comp.notes && <p className="component-notes">{comp.notes}</p>}
                          {comp.sourceUrl && (
                            <div className="component-source">
                              <a href={comp.sourceUrl} target="_blank" rel="noopener noreferrer">
                                ↗ {comp.sourceLabel || comp.sourceUrl}
                              </a>
                            </div>
                          )}
                          {!comp.sourceUrl && comp.sourceLabel && (
                            <div className="component-source">{comp.sourceLabel}</div>
                          )}
                        </>
                      )}
                    </div>
                    {!isEditingThis && (
                      <div className="component-actions">
                        <button
                          className="btn-ghost"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => setEditingComponent({ qIdx, componentId: comp.id })}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-danger"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => handleDeleteComponent(qIdx, qd.scoreId, comp.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              {isAddingHere && (
                <div style={{ padding: '12px 4px' }}>
                  <ComponentForm
                    initial={null}
                    onSave={handleAddComponent(qIdx, qd)}
                    onCancel={() => setAddingTo(null)}
                  />
                </div>
              )}
            </div>

            <NotesEditor
              scoreId={qd.scoreId}
              questionId={qd.question.id}
              candidateId={candidate.id}
              initialNotes={qd.notes}
            />
          </div>
        )
      })}
    </div>
  )
}
