'use client'

import { useState, useMemo, useCallback, Fragment } from 'react'
import { scoreLabel, scoreColor, scoreClass } from '../lib/scoring'
import ScoreChip from './ScoreChip'
import ScoreModal from './ScoreModal'

function sorted(list, party, sort) {
  const filtered = party === 'all' ? list : list.filter((c) => c.party === party)
  return [...filtered].sort((a, b) => {
    if (sort === 'state') return a.state.localeCompare(b.state)
    if (sort === 'score-asc') {
      if (a.overallScore === null && b.overallScore === null) return 0
      if (a.overallScore === null) return 1
      if (b.overallScore === null) return -1
      return a.overallScore - b.overallScore
    }
    if (sort === 'score-desc') {
      if (a.overallScore === null && b.overallScore === null) return 0
      if (a.overallScore === null) return 1
      if (b.overallScore === null) return -1
      return b.overallScore - a.overallScore
    }
    return a.name.localeCompare(b.name)
  })
}

export default function Scorecard({ candidates, questions }) {
  const [party, setParty] = useState('all')
  const [sort, setSort] = useState('name')
  const [expandedId, setExpandedId] = useState(null)
  const [modal, setModal] = useState(null)

  const list = useMemo(() => sorted(candidates, party, sort), [candidates, party, sort])

  const toggleExpand = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  const openModal = useCallback((candidate, qIdx, anchorRect) => {
    setModal({ candidate, qIdx, anchorRect })
  }, [])

  const closeModal = useCallback(() => setModal(null), [])

  return (
    <>
      {/* Legend */}
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
            <span className={`score-chip static ${cls}`}>{label}</span>
            {text}
          </span>
        ))}
      </div>

      {/* Controls */}
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
              onClick={() => { setParty(value); setExpandedId(null) }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="filter-group" style={{ marginLeft: 12 }}>
          <span className="filter-label">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Name (A–Z)</option>
            <option value="state">State (A–Z)</option>
            <option value="score-asc">Score (low→high)</option>
            <option value="score-desc">Score (high→low)</option>
          </select>
        </div>
        <span className="count">{list.length} senator{list.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Mobile cards ── */}
      <div className="cards-wrap">
        {list.map((c) => (
          <MobileCard
            key={c.id}
            candidate={c}
            questions={questions}
            isExpanded={expandedId === c.id}
            onToggle={() => toggleExpand(c.id)}
            onChipClick={openModal}
          />
        ))}
      </div>

      {/* ── Desktop table ── */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th onClick={() => setSort('name')} className={sort === 'name' ? 'sort-asc' : ''}>Senator</th>
              <th onClick={() => setSort('state')} className={sort === 'state' ? 'sort-asc' : ''}>State</th>
              <th>Party</th>
              {questions.map((q, i) => (
                <th key={q.id} title={q.text}>
                  Q{i + 1}<br />
                  <span style={{ fontWeight: 400, fontSize: 10 }}>{q.text.split(' ')[0]}</span>
                </th>
              ))}
              <th
                onClick={() => setSort(sort === 'score-desc' ? 'score-asc' : 'score-desc')}
                className={sort.startsWith('score') ? (sort === 'score-asc' ? 'sort-asc' : 'sort-desc') : ''}
              >
                Overall
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <Fragment key={c.id}>
                <tr
                  className={expandedId === c.id ? 'expanded' : ''}
                  onClick={() => toggleExpand(c.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="td-name">{c.name}</td>
                  <td className="td-state">{c.state}</td>
                  <td><span className={`party-badge ${c.party}`}>{c.party}</span></td>
                  {c.questionScores.map((qs, qIdx) => (
                    <td key={qs.questionId} className="score-cell">
                      <ScoreChip
                        score={qs.computed}
                        onClick={(e) => {
                          e.stopPropagation()
                          openModal(c, qIdx, e.currentTarget.getBoundingClientRect())
                        }}
                      />
                    </td>
                  ))}
                  <td>
                    {c.overallScore !== null ? (
                      <>
                        <span className="overall-chip">
                          <span className="overall-num" style={{ color: scoreColor(c.overallScore) }}>
                            {c.overallScore.toFixed(1)}
                          </span>
                          <span className="overall-label">{scoreLabel(c.overallScore)}</span>
                        </span>
                        <div className="na-count">{c.answeredCount}/{questions.length} answered</div>
                      </>
                    ) : (
                      <span className="overall-chip">
                        <span className="overall-num" style={{ color: '#aaa' }}>—</span>
                        <span className="overall-label">No data</span>
                      </span>
                    )}
                  </td>
                </tr>
                {expandedId === c.id && (
                  <tr className="detail-row">
                    <td colSpan={questions.length + 4}>
                      <DesktopDetailPanel candidate={c} questions={questions} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Score modal / popup */}
      {modal && (
        <ScoreModal
          candidate={modal.candidate}
          qIdx={modal.qIdx}
          questions={questions}
          anchorRect={modal.anchorRect}
          onClose={closeModal}
        />
      )}
    </>
  )
}

function MobileCard({ candidate: c, questions, isExpanded, onToggle, onChipClick }) {
  const avg = c.overallScore

  return (
    <div className={`senator-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="card-main" onClick={onToggle}>
        <div className="card-info">
          <div className="card-name">{c.name}</div>
          <div className="card-meta">
            <span>{c.state}</span>
            <span className={`party-badge ${c.party}`}>{c.party === 'D' ? 'Dem' : 'Rep'}</span>
          </div>
        </div>
        <div className="card-overall">
          {avg !== null ? (
            <>
              <div className="card-overall-num" style={{ color: scoreColor(avg) }}>
                {avg.toFixed(1)}
              </div>
              <div className="card-overall-label">{scoreLabel(avg)}</div>
            </>
          ) : (
            <>
              <div className="card-overall-num" style={{ color: '#aaa' }}>—</div>
              <div className="card-overall-label">No data</div>
            </>
          )}
        </div>
      </div>

      <div className="card-scores">
        {c.questionScores.map((qs, qIdx) => (
          <div key={qs.questionId} className="card-score-item">
            <span className="card-q-label">Q{qIdx + 1}</span>
            <ScoreChip
              score={qs.computed}
              onClick={(e) => {
                e.stopPropagation()
                onChipClick(c, qIdx, e.currentTarget.getBoundingClientRect())
              }}
            />
          </div>
        ))}
      </div>

      {isExpanded && (
        <div className="card-detail">
          <div className="detail-panel">
            <div className="detail-grid">
              {c.questionScores.map((qs, qIdx) => (
                <div key={qs.questionId} className="detail-card">
                  <div className="detail-card-header">
                    <ScoreChip score={qs.computed} className="static" />
                    <span className="detail-q-label">Q{qIdx + 1}: {qs.questionText}</span>
                  </div>
                  <p className="detail-evidence">
                    {qs.notes || (qs.components[0]?.notes) || (
                      <em className="no-position">No publicly stated position found.</em>
                    )}
                  </p>
                  {qs.components.map((comp, ci) => (
                    comp.sourceUrl ? (
                      <div key={ci} className="detail-source">
                        Source: <a href={comp.sourceUrl} target="_blank" rel="noopener noreferrer">{comp.sourceLabel || comp.sourceUrl}</a>
                      </div>
                    ) : comp.sourceLabel ? (
                      <div key={ci} className="detail-source">Source: {comp.sourceLabel}</div>
                    ) : null
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DesktopDetailPanel({ candidate: c, questions }) {
  return (
    <div className="detail-panel">
      <div className="detail-grid">
        {c.questionScores.map((qs, qIdx) => (
          <div key={qs.questionId} className="detail-card">
            <div className="detail-card-header">
              <ScoreChip score={qs.computed} className="static" />
              <span className="detail-q-label">Q{qIdx + 1}: {qs.questionText}</span>
            </div>
            <p className="detail-evidence">
              {qs.notes || qs.components[0]?.notes || (
                <em className="no-position">No publicly stated position found.</em>
              )}
            </p>
            {qs.components.map((comp, ci) => (
              comp.sourceUrl ? (
                <div key={ci} className="detail-source">
                  Source: <a href={comp.sourceUrl} target="_blank" rel="noopener noreferrer">{comp.sourceLabel || comp.sourceUrl}</a>
                </div>
              ) : comp.sourceLabel ? (
                <div key={ci} className="detail-source">Source: {comp.sourceLabel}</div>
              ) : null
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
