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
    </div>
  )
}
