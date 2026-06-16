'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { weightedScore, overallScore, scoreLabel, scoreColor, indicatorTypeLabel } from '../lib/scoring'

const INDICATOR_TYPES = ['BILL_VOTE', 'PUBLIC_STATEMENT', 'CAMPAIGN_STATEMENT', 'CUSTOM']

function computeCandidates(candidatesRaw, typeWeights) {
  return candidatesRaw.map((c) => {
    const qScores = c.perQuestion.map((q) => {
      const items = q.assessments.map((a) => ({
        value: a.value,
        weight: a.wOverride ?? a.iWeight ?? typeWeights[a.type] ?? 1.0,
      }))
      return weightedScore(items)
    })
    return {
      ...c,
      overallScore: overallScore(qScores),
      answeredCount: qScores.filter(v => v !== null).length,
      totalQ: c.perQuestion.length,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
}

export default function EditorWeightsView({ candidatesRaw, questions, initialTypeWeights }) {
  const [typeWeights, setTypeWeights] = useState(initialTypeWeights)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [weightsOpen, setWeightsOpen] = useState(false)

  const candidates = useMemo(
    () => computeCandidates(candidatesRaw, typeWeights),
    [candidatesRaw, typeWeights]
  )

  const setWeight = useCallback((type, val) => {
    setTypeWeights(prev => ({ ...prev, [type]: val }))
    setSavedMsg('')
  }, [])

  async function saveWeights() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/weights', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights: typeWeights }),
      })
      if (res.ok) {
        setSavedMsg('Saved')
        setTimeout(() => setSavedMsg(''), 2500)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-wrap">
      <div className="page-header">
        <h1>Candidates</h1>
        <span style={{ fontSize: 13, color: '#888' }}>{candidates.length} total</span>
      </div>

      {/* Weight sliders panel */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', cursor: 'pointer' }}
          onClick={() => setWeightsOpen(o => !o)}
        >
          <span style={{ fontWeight: 600, fontSize: 14, color: '#1F3B57' }}>
            Score Weights
          </span>
          <span style={{ fontSize: 12, color: '#888' }}>
            {weightsOpen ? '▲ hide' : '▼ show'} · changes preview scores live
          </span>
        </div>

        {weightsOpen && (
          <div style={{ padding: '4px 16px 16px', borderTop: '1px solid #edf0f3' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 14 }}>
              {INDICATOR_TYPES.map((type) => {
                const val = typeWeights[type] ?? 1.0
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{indicatorTypeLabel(type)}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1F3B57', minWidth: 32, textAlign: 'right' }}>
                        {val.toFixed(1)}×
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="0.1"
                      value={val}
                      onChange={(e) => setWeight(type, parseFloat(e.target.value))}
                      style={{ width: '100%', accentColor: '#1F3B57' }}
                    />
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn-primary" onClick={saveWeights} disabled={saving} style={{ fontSize: 13 }}>
                {saving ? 'Saving…' : 'Save weights'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => setTypeWeights(initialTypeWeights)}
                style={{ fontSize: 13 }}
              >
                Reset
              </button>
              {savedMsg && <span style={{ fontSize: 12, color: '#27ae60' }}>{savedMsg}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Candidate table */}
      <div className="card">
        <table className="table-simple">
          <thead>
            <tr>
              <th>Name</th>
              <th>State</th>
              <th>Party</th>
              <th>Overall Score</th>
              <th>Coverage</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td style={{ color: '#555' }}>{c.state}</td>
                <td>
                  <span className={`party-badge ${c.party}`}>{c.party}</span>
                </td>
                <td>
                  {c.overallScore !== null ? (
                    <span style={{ fontWeight: 700, color: scoreColor(c.overallScore) }}>
                      {c.overallScore.toFixed(1)}{' '}
                      <span style={{ fontWeight: 400, color: '#666', fontSize: 12 }}>
                        {scoreLabel(c.overallScore)}
                      </span>
                    </span>
                  ) : (
                    <span style={{ color: '#aaa' }}>—</span>
                  )}
                </td>
                <td style={{ color: '#666', fontSize: 13 }}>
                  {c.answeredCount}/{c.totalQ} questions
                </td>
                <td>
                  <Link
                    href={`/editor/candidates/${c.id}`}
                    className="btn-ghost"
                    style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}
                  >
                    Edit scores
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
