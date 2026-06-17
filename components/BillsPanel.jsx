'use client'

import { useState, useEffect, useCallback } from 'react'

const STANCE_LABELS = { 1: 'Skeptic', 2: 'Lean Skeptic', 3: 'Mixed', 4: 'Lean Booster', 5: 'Booster' }
const STANCE_COLORS = { 1: '#c0392b', 2: '#d4700a', 3: '#b8960a', 4: '#27ae60', 5: '#1a6b3a' }

function LoadBadge({ status, error }) {
  const styles = {
    PENDING: { bg: '#f0f0f0', color: '#888' },
    LOADED:  { bg: '#e8f5e9', color: '#2e7d32' },
    ERROR:   { bg: '#fdecea', color: '#c62828' },
  }
  const s = styles[status] ?? styles.PENDING
  return (
    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: s.bg, color: s.color, fontWeight: 600 }}>
      {status === 'ERROR' ? `Error${error ? ': ' + error.slice(0, 40) : ''}` : status}
    </span>
  )
}

function AddBillForm({ questions, onAdded }) {
  const [billId, setBillId]       = useState('')
  const [congress, setCongress]   = useState('119')
  const [questionId, setQuestionId] = useState(questions[0]?.id ?? '')
  const [yesMeans, setYesMeans]   = useState('3')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/admin/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId, congress: parseInt(congress), questionId, yesMeans: parseInt(yesMeans) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBillId('')
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 20 }}>
      <div className="form-group" style={{ flex: '1 1 160px' }}>
        <label className="form-label">Bill ID</label>
        <input className="form-input" placeholder="H.R. 7103 or S. 1234" value={billId}
          onChange={e => setBillId(e.target.value)} required />
      </div>
      <div className="form-group" style={{ flex: '0 0 80px' }}>
        <label className="form-label">Congress</label>
        <input className="form-input" type="number" value={congress}
          onChange={e => setCongress(e.target.value)} required />
      </div>
      <div className="form-group" style={{ flex: '2 1 240px' }}>
        <label className="form-label">Question</label>
        <select className="form-input" value={questionId} onChange={e => setQuestionId(e.target.value)} required>
          {questions.map((q, i) => (
            <option key={q.id} value={q.id}>Q{i + 1}: {q.text.slice(0, 60)}</option>
          ))}
        </select>
      </div>
      <div className="form-group" style={{ flex: '0 0 180px' }}>
        <label className="form-label">YES vote → stance</label>
        <select className="form-input" value={yesMeans} onChange={e => setYesMeans(e.target.value)} required>
          {[1, 2, 3, 4, 5].map(v => (
            <option key={v} value={v}>{v} — {STANCE_LABELS[v]}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Loading…' : '+ Track bill'}
        </button>
      </div>
      {error && <div style={{ width: '100%', color: '#c62828', fontSize: 13 }}>{error}</div>}
    </form>
  )
}

function BillRow({ bill: b, questions, onReload, onDelete }) {
  const [editing, setEditing]     = useState(false)
  const [yesMeans, setYesMeans]   = useState(b.yesMeans ?? 3)
  const [questionId, setQid]      = useState(b.question?.id ?? '')
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/admin/bills/${b.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yesMeans, questionId }),
    })
    setSaving(false)
    setEditing(false)
    onReload()
  }

  async function handleLoad() {
    setLoading(true)
    await fetch(`/api/admin/bills/${b.id}/load`, { method: 'POST' })
    setLoading(false)
    onReload()
  }

  async function handleDelete() {
    if (!confirm(`Delete "${b.title}" and all ${b.evidenceTotal} Evidence rows?`)) return
    await fetch(`/api/admin/bills/${b.id}`, { method: 'DELETE' })
    onReload()
  }

  const qIdx = questions.findIndex(q => q.id === b.question?.id)
  const qLabel = qIdx >= 0 ? `Q${qIdx + 1}: ${b.question.text.slice(0, 40)}` : '—'

  return (
    <tr>
      <td style={{ fontWeight: 600 }}>
        {b.bill ? (
          <>
            <div style={{ fontSize: 13 }}>{b.bill.number.toUpperCase().replace(/^([a-z]+)(\d+)/, '$1 $2').toUpperCase()}</div>
            <div style={{ fontSize: 11, color: '#666', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.bill.title}</div>
          </>
        ) : <span style={{ color: '#aaa' }}>—</span>}
      </td>
      <td style={{ fontSize: 12 }}>{b.bill?.congress ?? '—'}</td>
      <td style={{ fontSize: 12 }}>
        {editing ? (
          <select className="form-input" style={{ fontSize: 12, padding: '2px 6px' }}
            value={questionId} onChange={e => setQid(e.target.value)}>
            {questions.map((q, i) => <option key={q.id} value={q.id}>Q{i+1}: {q.text.slice(0,50)}</option>)}
          </select>
        ) : qLabel}
      </td>
      <td style={{ textAlign: 'center' }}>
        {editing ? (
          <select className="form-input" style={{ fontSize: 12, padding: '2px 6px', width: 140 }}
            value={yesMeans} onChange={e => setYesMeans(parseInt(e.target.value))}>
            {[1,2,3,4,5].map(v => <option key={v} value={v}>{v} — {STANCE_LABELS[v]}</option>)}
          </select>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700, color: STANCE_COLORS[b.yesMeans] ?? '#888' }}>
            {b.yesMeans ?? '—'} {b.yesMeans ? `(${STANCE_LABELS[b.yesMeans]})` : ''}
          </span>
        )}
      </td>
      <td style={{ textAlign: 'center', fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>{b.evidencePublished}</span>
        <span style={{ color: '#aaa' }}> / {b.evidenceTotal}</span>
      </td>
      <td><LoadBadge status={b.rollCall?.loadStatus ?? 'PENDING'} error={b.rollCall?.loadError} /></td>
      <td>
        <div style={{ display: 'flex', gap: 6 }}>
          {editing ? (
            <>
              <button className="btn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={handleSave} disabled={saving}>
                {saving ? '…' : 'Save'}
              </button>
              <button className="btn" style={{ fontSize: 11, padding: '3px 8px', background: '#f5f5f5', color: '#333' }}
                onClick={() => setEditing(false)}>Cancel</button>
            </>
          ) : (
            <>
              <button className="btn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setEditing(true)}>Edit</button>
              <button className="btn" style={{ fontSize: 11, padding: '3px 8px', background: '#f0f4f8' }}
                onClick={handleLoad} disabled={loading} title="Re-fetch all member votes">
                {loading ? '…' : 'Reload'}
              </button>
              <button className="btn-danger" style={{ fontSize: 11, padding: '3px 8px' }} onClick={handleDelete}>Del</button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function BillsPanel({ questions }) {
  const [bills, setBills]       = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/bills')
    setBills(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1F3B57', marginBottom: 14 }}>
        Bill Vote Tracker
      </h2>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        Bills tracked here are scored for all candidates at once using official congressional vote data.
        The researcher auto-adds bills it discovers; you can also add or edit them manually.
        <strong> YES → stance</strong> sets what a YES vote means on the 1–5 scale.
      </p>

      <AddBillForm questions={questions} onAdded={load} />

      <div className="card">
        {loading ? (
          <div style={{ padding: 24, color: '#888', textAlign: 'center' }}>Loading…</div>
        ) : bills.length === 0 ? (
          <div style={{ padding: 24, color: '#888', textAlign: 'center' }}>
            No bills tracked yet. The researcher will add bills as it discovers them,
            or add one manually above.
          </div>
        ) : (
          <table className="table-simple">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Congress</th>
                <th>Question</th>
                <th style={{ textAlign: 'center' }}>YES →</th>
                <th style={{ textAlign: 'center' }}>Scored</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map(b => (
                <BillRow key={b.id} bill={b} questions={questions} onReload={load} onDelete={load} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
