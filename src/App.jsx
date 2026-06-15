import { useState, useMemo, useCallback, Fragment } from 'react'
import { SENATORS, QUESTIONS, overallScore, scoreLabel, scoreColor } from './data/senators'
import ScoreChip from './components/ScoreChip'
import DetailPanel from './components/DetailPanel'
import Popup from './components/Popup'

function filteredAndSorted(senators, party, sort) {
  let list = party === 'all' ? senators : senators.filter(s => s.party === party)
  return [...list].sort((a, b) => {
    const avgA = overallScore(a.scores)
    const avgB = overallScore(b.scores)
    if (sort === 'state') return a.state.localeCompare(b.state)
    if (sort === 'score-asc') {
      if (avgA === null && avgB === null) return 0
      if (avgA === null) return 1
      if (avgB === null) return -1
      return avgA - avgB
    }
    if (sort === 'score-desc') {
      if (avgA === null && avgB === null) return 0
      if (avgA === null) return 1
      if (avgB === null) return -1
      return avgB - avgA
    }
    return a.name.localeCompare(b.name)
  })
}

export default function App() {
  const [party, setParty] = useState('all')
  const [sort, setSort] = useState('name')
  const [expandedName, setExpandedName] = useState(null)
  const [popup, setPopup] = useState(null)

  const list = useMemo(() => filteredAndSorted(SENATORS, party, sort), [party, sort])

  const toggleExpand = useCallback((name) => {
    setExpandedName(prev => prev === name ? null : name)
    setPopup(null)
  }, [])

  const openPopup = useCallback((e, senator, qIdx) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setPopup({ senator, qIdx, anchorRect: rect })
  }, [])

  const closePopup = useCallback(() => setPopup(null), [])

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <h1>Senate AI Policy Tracker — 2026 Incumbents</h1>
        <p>Class 2 senators running for reelection · Scored from public statements, votes, and legislation as of June 2026 · For editorial review</p>
      </header>

      {/* ── Legend ── */}
      <div className="legend">
        <span className="legend-title">Score scale</span>
        {[
          { cls: 's1', label: '1', text: 'AI Skeptic' },
          { cls: 's2', label: '2', text: 'Lean Skeptic' },
          { cls: 's3', label: '3', text: 'Mixed' },
          { cls: 's4', label: '4', text: 'Lean Booster' },
          { cls: 's5', label: '5', text: 'AI Booster' },
          { cls: 'snull', label: '–', text: 'No stated position' },
        ].map(({ cls, label, text }) => (
          <span key={cls} className="legend-item">
            <span className={`score-chip ${cls}`} style={{ cursor: 'default' }}>{label}</span>
            {text}
          </span>
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="controls">
        <div className="filter-group">
          <span className="filter-label">Party</span>
          {[
            { value: 'all', label: 'All', extra: '' },
            { value: 'D', label: 'Democrats', extra: 'party-d' },
            { value: 'R', label: 'Republicans', extra: 'party-r' },
          ].map(({ value, label, extra }) => (
            <button
              key={value}
              className={`btn ${extra} ${party === value ? 'active' : ''}`}
              onClick={() => { setParty(value); setExpandedName(null) }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="filter-group" style={{ marginLeft: 16 }}>
          <span className="filter-label">Sort</span>
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="name">Name (A–Z)</option>
            <option value="state">State (A–Z)</option>
            <option value="score-asc">Overall Score (low→high)</option>
            <option value="score-desc">Overall Score (high→low)</option>
          </select>
        </div>
        <span className="count">{list.length} senator{list.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Table ── */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th onClick={() => setSort('name')} className={sort === 'name' ? 'sort-asc' : ''}>Senator</th>
              <th onClick={() => setSort('state')} className={sort === 'state' ? 'sort-asc' : ''}>State</th>
              <th>Party</th>
              {QUESTIONS.map((q, i) => (
                <th key={i} title={q}>
                  Q{i + 1}<br /><span style={{ fontWeight: 400, fontSize: 10 }}>{q.split(' ')[0]}</span>
                </th>
              ))}
              <th onClick={() => setSort(sort === 'score-desc' ? 'score-asc' : 'score-desc')}
                  className={sort.startsWith('score') ? (sort === 'score-asc' ? 'sort-asc' : 'sort-desc') : ''}>
                Overall
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((sen) => {
              const avg = overallScore(sen.scores)
              const answered = sen.scores.filter(s => s.score !== null).length
              const isExpanded = expandedName === sen.name

              return (
                <Fragment key={sen.name}>
                  <tr
                    className={isExpanded ? 'expanded' : ''}
                    onClick={() => toggleExpand(sen.name)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="td-name">{sen.name}</td>
                    <td className="td-state">{sen.state}</td>
                    <td>
                      <span className={`party-badge ${sen.party}`}>{sen.party}</span>
                    </td>
                    {sen.scores.map((s, qIdx) => (
                      <td key={qIdx} className="score-cell">
                        <ScoreChip
                          score={s.score}
                          onClick={(e) => openPopup(e, sen, qIdx)}
                        />
                      </td>
                    ))}
                    <td>
                      {avg !== null ? (
                        <>
                          <span className="overall-chip">
                            <span className="overall-num" style={{ color: scoreColor(avg) }}>
                              {avg.toFixed(1)}
                            </span>
                            <span className="overall-label">{scoreLabel(avg)}</span>
                          </span>
                          <div className="na-count">{answered}/5 answered</div>
                        </>
                      ) : (
                        <span className="overall-chip">
                          <span className="overall-num" style={{ color: '#aaa' }}>—</span>
                          <span className="overall-label">No data</span>
                        </span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && <DetailPanel senator={sen} />}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <footer className="footer">
        <p>
          <strong>Questions: </strong>
          {QUESTIONS.map((q, i) => `Q${i + 1} ${q}`).join(' — ')}
        </p>
        <p>
          <strong>Scoring: </strong>
          1 = most skeptic/restrictive · 5 = most pro-acceleration/deregulatory · Scores of 2 and 4 mark intermediate positions · "–" = no publicly stated position (excluded from average)
        </p>
        <p>
          <strong>Key vote: </strong>
          The Q2 score for virtually all incumbents is anchored by the July 1, 2025 Senate vote (99–1) to strip the 10-year AI moratorium on state regulations from the "One Big Beautiful Bill."
        </p>
      </footer>

      {/* ── Popup ── */}
      <Popup popup={popup} onClose={closePopup} />
    </div>
  )
}
