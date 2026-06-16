'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function UsersPanel({ users }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('EDITOR')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setAdding(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    })
    const data = await res.json()
    setAdding(false)
    if (!res.ok) { setError(data.error || 'Failed'); return }
    setEmail(''); setPassword('')
    router.refresh()
  }

  async function handleDelete(id) {
    if (!confirm('Remove this user?')) return
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1F3B57', marginBottom: 14 }}>Users</h2>
      <div className="card" style={{ marginBottom: 20 }}>
        <table className="table-simple">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td><span style={{ fontWeight: 600 }}>{u.role}</span></td>
                <td style={{ color: '#888', fontSize: 12 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>
                  <button className="btn-danger" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => handleDelete(u.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-body">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Add user</h3>
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="EDITOR">Editor</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={adding}>
              {adding ? 'Adding…' : 'Add user'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}

function QuestionsPanel({ questions }) {
  const router = useRouter()
  const [editing, setEditing] = useState(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  function startEdit(q) {
    setEditing(q.id)
    setText(q.text)
  }

  async function saveEdit(id) {
    setSaving(true)
    await fetch(`/api/admin/questions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    setSaving(false)
    setEditing(null)
    router.refresh()
  }

  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1F3B57', marginBottom: 14 }}>Policy Questions</h2>
      <div className="card">
        <table className="table-simple">
          <thead>
            <tr>
              <th>#</th>
              <th>Question Text</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q, i) => (
              <tr key={q.id}>
                <td style={{ fontWeight: 700, color: '#1F3B57', width: 32 }}>Q{i + 1}</td>
                <td>
                  {editing === q.id ? (
                    <input
                      className="form-input"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <span style={{ fontSize: 13 }}>{q.text}</span>
                  )}
                </td>
                <td>
                  {editing === q.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => saveEdit(q.id)} disabled={saving}>
                        Save
                      </button>
                      <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => startEdit(q)}>
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function GroupsPanel({ groups, candidateCount }) {
  const router = useRouter()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    await fetch('/api/admin/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
    setCreating(false)
    setNewName('')
    router.refresh()
  }

  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1F3B57', marginBottom: 14 }}>
        Candidate Groups
        <span style={{ fontSize: 12, fontWeight: 400, color: '#888', marginLeft: 10 }}>
          {candidateCount} total candidates
        </span>
      </h2>

      <div className="card" style={{ marginBottom: 20 }}>
        {groups.length === 0 ? (
          <div className="empty-state">No groups yet. Create one below to organize candidates for bulk editing.</div>
        ) : (
          <table className="table-simple">
            <thead>
              <tr>
                <th>Group Name</th>
                <th>Members</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td style={{ fontWeight: 600 }}>{g.name}</td>
                  <td style={{ color: '#666', fontSize: 13 }}>
                    {g.candidates.map((c) => `${c.name} (${c.state})`).join(', ') || 'No members'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-body">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>New group</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 10 }}>
            <input
              className="form-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Group name (e.g. Class 2 Democrats)"
              required
            />
            <button type="submit" className="btn-primary" style={{ flex: 'none' }} disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}

function FinderPanel() {
  const [offices, setOffices] = useState({ S: true, H: true })
  const [cycle, setCycle] = useState(2026)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function run(dryRun) {
    setRunning(true)
    setResult(null)
    setError('')
    try {
      const selectedOffices = Object.entries(offices).filter(([, v]) => v).map(([k]) => k)
      const res = await fetch('/api/agent/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offices: selectedOffices, cycle, dryRun }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1F3B57', marginBottom: 14 }}>Candidate Finder</h2>
      <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>
          Pulls incumbents running for re-election from the FEC API and creates Candidate records.
          Deduplicates by FEC candidate ID — existing records are skipped.
        </p>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>Offices</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[['S', 'Senate'], ['H', 'House']].map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={offices[key]}
                    onChange={(e) => setOffices(o => ({ ...o, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>Election cycle</div>
            <input
              className="form-input"
              type="number"
              value={cycle}
              onChange={(e) => setCycle(parseInt(e.target.value, 10))}
              style={{ width: 90 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={() => run(true)} disabled={running} style={{ fontSize: 13 }}>
              {running ? 'Running…' : 'Preview (dry run)'}
            </button>
            <button className="btn-primary" onClick={() => run(false)} disabled={running} style={{ fontSize: 13 }}>
              {running ? 'Running…' : 'Run Finder'}
            </button>
          </div>
        </div>

        {error && <div className="error-msg" style={{ marginTop: 16 }}>{error}</div>}

        {result && (
          <div style={{ marginTop: 20, fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: result.dryRun ? '#e65100' : '#2e7d32' }}>
              {result.dryRun ? 'Dry run — no changes made' : 'Done'}
            </div>
            <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
              <span><strong>{result.created.length}</strong> {result.dryRun ? 'would be added' : 'added'}</span>
              <span><strong>{result.skipped.length}</strong> skipped (already exist)</span>
              {result.errors.length > 0 && <span style={{ color: '#c62828' }}><strong>{result.errors.length}</strong> errors</span>}
            </div>
            {result.created.length > 0 && (
              <div style={{ maxHeight: 200, overflowY: 'auto', background: '#f8fafc', borderRadius: 6, padding: '8px 12px' }}>
                {result.created.map((c, i) => (
                  <div key={i} style={{ fontSize: 12, padding: '2px 0', color: '#333' }}>
                    {c.name} · {c.office} · <span className={`party-badge ${c.party}`}>{c.party}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function ResearchPanel({ candidateCount }) {
  const [batchSize, setBatchSize] = useState(20)
  const [office, setOffice] = useState('all')
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState([])
  const [summary, setSummary] = useState(null)

  async function startBatch() {
    setRunning(true)
    setLog([])
    setSummary(null)

    try {
      const resp = await fetch('/api/agent/research/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize, office: office === 'all' ? undefined : office }),
      })

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const evt = JSON.parse(line.slice(6))

          if (evt.type === 'start') {
            setLog([`Starting research on ${evt.total} candidates…`])
          } else if (evt.type === 'progress') {
            setLog(prev => [...prev, `[${evt.current}/${evt.total}] ${evt.name} (${evt.office ?? ''})`])
          } else if (evt.type === 'candidate_done') {
            setLog(prev => [...prev.slice(0, -1),
              `[done] ${evt.name} — ${evt.findings} findings, ${evt.assessed} scored${evt.errors > 0 ? `, ${evt.errors} errors` : ''}`
            ])
          } else if (evt.type === 'candidate_error') {
            setLog(prev => [...prev, `[error] ${evt.name}: ${evt.error}`])
          } else if (evt.type === 'complete') {
            setSummary(evt)
          } else if (evt.type === 'error') {
            setLog(prev => [...prev, `Fatal error: ${evt.error}`])
          }
        }
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <section>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1F3B57', marginBottom: 14 }}>Batch Research</h2>
      <div className="card" style={{ padding: '20px 24px', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>
          Runs the research pipeline (Serper search → MiniMax categorization → scoring) for candidates
          that have not yet been researched. Processes one candidate at a time and streams progress.
        </p>

        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div className="form-label" style={{ marginBottom: 6 }}>Batch size</div>
            <select className="form-select" value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} style={{ width: 80 }}>
              {[5, 10, 20].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <div className="form-label" style={{ marginBottom: 6 }}>Office</div>
            <select className="form-select" value={office} onChange={e => setOffice(e.target.value)}>
              <option value="all">All ({candidateCount})</option>
              <option value="S">Senate only</option>
              <option value="H">House only</option>
            </select>
          </div>
          <button className="btn-primary" onClick={startBatch} disabled={running} style={{ fontSize: 13 }}>
            {running ? 'Researching…' : 'Run Research Batch'}
          </button>
        </div>

        {summary && (
          <div style={{ background: '#e8f5e9', borderRadius: 6, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
            <strong style={{ color: '#2e7d32' }}>Batch complete</strong>
            {' — '}
            {summary.total} candidates · {summary.totalFindings} findings · {summary.totalAssessed} scored
            {summary.totalErrors > 0 && <span style={{ color: '#c62828' }}> · {summary.totalErrors} errors</span>}
          </div>
        )}

        {log.length > 0 && (
          <div style={{
            maxHeight: 300, overflowY: 'auto', background: '#f8fafc',
            borderRadius: 6, padding: '8px 12px', fontFamily: 'monospace', fontSize: 12,
          }}>
            {log.map((line, i) => (
              <div key={i} style={{ padding: '2px 0', color: line.startsWith('[error]') ? '#c62828' : line.startsWith('[done]') ? '#2e7d32' : '#333' }}>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default function AdminDashboard({ users, questions, groups, candidateCount }) {
  const [tab, setTab] = useState('questions')

  return (
    <div className="page-wrap">
      <div className="page-header">
        <h1>Admin</h1>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #dde1e7' }}>
        {[
          { key: 'questions', label: 'Questions' },
          { key: 'groups', label: 'Groups' },
          { key: 'users', label: 'Users' },
          { key: 'research', label: 'Research' },
          { key: 'agents', label: 'Agents' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${tab === key ? '#1F3B57' : 'transparent'}`,
              color: tab === key ? '#1F3B57' : '#666',
              fontWeight: tab === key ? 700 : 400,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'questions' && <QuestionsPanel questions={questions} />}
      {tab === 'groups' && <GroupsPanel groups={groups} candidateCount={candidateCount} />}
      {tab === 'users' && <UsersPanel users={users} />}
      {tab === 'research' && <ResearchPanel candidateCount={candidateCount} />}
      {tab === 'agents' && <FinderPanel />}
    </div>
  )
}
