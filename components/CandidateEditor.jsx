'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ScoreChip from './ScoreChip'
import { scoreLabel, indicatorTypeLabel } from '../lib/scoring'

const STATUS_STYLE = {
  UNVERIFIED:       { background: '#f5f5f5', color: '#666' },
  MACHINE_VERIFIED: { background: '#e8f5e9', color: '#2e7d32' },
  AUTO_CORRECTED:   { background: '#e3f2fd', color: '#1565c0' },
  FLAGGED:          { background: '#fff3e0', color: '#e65100' },
  HUMAN_REVIEWED:   { background: '#f3e5f5', color: '#6a1b9a' },
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
          min="1" max="5" step="1"
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
  const router = useRouter()
  const [indicatorData, setIndicatorData] = useState(initialData)
  const [editing, setEditing] = useState(null)   // indicatorId
  const [assessing, setAssessing] = useState(null) // indicatorId
  const [researching, setResearching] = useState(false)
  const [researchResult, setResearchResult] = useState(null)
  const [researchError, setResearchError] = useState('')

  // Group indicators by question (preserving question order)
  const questionGroups = useMemo(() => {
    const map = new Map()
    for (const item of indicatorData) {
      const qid = item.question.id
      if (!map.has(qid)) map.set(qid, { question: item.question, items: [] })
      map.get(qid).items.push(item)
    }
    return [...map.values()]
  }, [indicatorData])

  const handleSave = useCallback((indicatorId) => async (payload) => {
    const item = indicatorData.find(d => d.indicator.id === indicatorId)
    if (!item?.assessmentId) return
    const res = await fetch(`/api/assessments/${item.assessmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return
    const updated = await res.json()
    setIndicatorData(prev => prev.map(d =>
      d.indicator.id === indicatorId
        ? { ...d, value: updated.value, rationale: updated.rationale, reviewStatus: updated.reviewStatus, computed: updated.value }
        : d
    ))
    setEditing(null)
  }, [indicatorData])

  const handleAssess = useCallback(async (indicatorId) => {
    setAssessing(indicatorId)
    try {
      const res = await fetch('/api/agent/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidate.id, indicatorId }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Assessment failed'); return }
      const a = data.assessment
      setIndicatorData(prev => prev.map(d =>
        d.indicator.id === indicatorId
          ? { ...d, assessmentId: a.id, value: a.value, rationale: a.rationale, reviewStatus: a.reviewStatus, computed: a.value }
          : d
      ))
    } finally {
      setAssessing(null)
    }
  }, [candidate.id])

  async function handleResearch() {
    setResearching(true)
    setResearchResult(null)
    setResearchError('')
    try {
      const res = await fetch('/api/agent/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidate.id }),
      })
      const data = await res.json()
      if (!res.ok) { setResearchError(data.error ?? 'Research failed'); return }
      setResearchResult(data)
      router.refresh()
    } catch (e) {
      setResearchError(e.message)
    } finally {
      setResearching(false)
    }
  }

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <Link href="/editor" style={{ fontSize: 13, color: '#1565C0', textDecoration: 'none' }}>← Candidates</Link>
          <h1 style={{ marginTop: 6 }}>{candidate.name}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 13, color: '#666' }}>{candidate.state}</span>
            {candidate.office && <span style={{ fontSize: 13, color: '#666' }}>{candidate.office}</span>}
            <span className={`party-badge ${candidate.party}`}>{candidate.party}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <button
            className="btn-primary"
            onClick={handleResearch}
            disabled={researching}
            style={{ fontSize: 13 }}
          >
            {researching ? 'Researching…' : 'Run Research'}
          </button>
          {researching && (
            <span style={{ fontSize: 12, color: '#666' }}>
              Searching sources + scoring findings — this takes ~30–60s
            </span>
          )}
          {researchError && (
            <span style={{ fontSize: 12, color: '#c62828' }}>{researchError}</span>
          )}
          {researchResult && (
            <span style={{ fontSize: 12, color: '#2e7d32' }}>
              Done — {researchResult.findings} findings, {researchResult.assessed} scored
              {researchResult.errors?.length > 0 ? `, ${researchResult.errors.length} errors` : ''}
            </span>
          )}
        </div>
      </div>

      {questionGroups.map(({ question, items }, qIdx) => (
        <div key={question.id} className="question-section">
          <div className="question-section-header">
            <div className="question-section-title">
              Q{qIdx + 1}: {question.text}
            </div>
          </div>

          {items.map((item) => {
            const isEditingHere = editing === item.indicator.id
            const isAssessingHere = assessing === item.indicator.id
            const statusStyle = STATUS_STYLE[item.reviewStatus] ?? STATUS_STYLE.UNVERIFIED
            const canReassess = item.reviewStatus !== 'HUMAN_REVIEWED'
            const isCustom = item.indicator.type === 'CUSTOM'

            return (
              <div key={item.indicator.id} style={{ borderTop: '1px solid #edf0f3' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#fafbfc' }}>
                  {/* Indicator type + name */}
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                    {indicatorTypeLabel(item.indicator.type)}
                  </span>
                  {!isCustom && (
                    <span style={{ fontSize: 12, color: '#444', flex: 1 }}>{item.indicator.name}</span>
                  )}
                  <ScoreChip score={item.computed} className="static" />
                  <span style={{ fontSize: 12, color: '#666' }}>
                    {item.computed !== null ? scoreLabel(item.computed) : 'No score'}
                  </span>
                  <span style={{ ...statusStyle, fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                    {item.reviewStatus.replace(/_/g, ' ')}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    {canReassess && (
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 12, padding: '4px 10px', color: '#1565C0' }}
                        disabled={isAssessingHere || editing !== null}
                        onClick={() => handleAssess(item.indicator.id)}
                      >
                        {isAssessingHere ? 'Assessing…' : 'Run AI'}
                      </button>
                    )}
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => setEditing(isEditingHere ? null : item.indicator.id)}
                    >
                      {isEditingHere ? 'Cancel' : 'Edit'}
                    </button>
                  </div>
                </div>

                {isEditingHere ? (
                  <div style={{ padding: '0 20px' }}>
                    <AssessmentForm
                      initial={item}
                      onSave={handleSave(item.indicator.id)}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                ) : (
                  <div className="component-list">
                    {item.rationale ? (
                      <div className="component-item" style={{ display: 'block' }}>
                        <p className="component-notes" style={{ margin: 0 }}>{item.rationale}</p>
                      </div>
                    ) : (
                      <div className="empty-state" style={{ padding: '12px 20px' }}>
                        No rationale recorded.
                      </div>
                    )}
                    {item.sources.filter(s => s.url || s.title).map((source) => (
                      <div key={source.id} className="component-source" style={{ padding: '6px 20px' }}>
                        {source.url ? (
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            ↗ {source.title || source.url}
                          </a>
                        ) : source.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
