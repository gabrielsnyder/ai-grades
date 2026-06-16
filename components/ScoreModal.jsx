'use client'

import { useEffect, useRef } from 'react'
import { scoreLabel, scoreClass } from '../lib/scoring'
import ScoreChip from './ScoreChip'

export default function ScoreModal({ candidate, qIdx, questions, anchorRect, onClose }) {
  const ref = useRef(null)
  const qs = candidate.questionScores[qIdx]
  const question = questions[qIdx]

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const keyHandler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  // Desktop: position near the chip
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
  let desktopStyle = {}
  if (isDesktop && anchorRect) {
    const PW = 380
    let left = anchorRect.right + 8
    let top = anchorRect.top + window.scrollY - 8
    if (left + PW > window.innerWidth - 12) left = anchorRect.left - PW - 8
    if (left < 8) left = 8
    const maxTop = document.documentElement.scrollHeight - 240
    if (top > maxTop) top = maxTop
    if (top < 8) top = 8
    desktopStyle = { left, top, width: PW }
  }

  const evidence = qs.rationale || 'No publicly stated position found.'
  const sources = (qs.sources || []).filter(s => s.url || s.title)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="modal-sheet"
        style={isDesktop ? desktopStyle : {}}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-handle" />
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-title">
          {candidate.name} · Q{qIdx + 1}: {question.text}
        </div>
        <div className="modal-score-row">
          <ScoreChip score={qs.computed} className="static" />
          <span style={{ fontSize: 13, color: '#555' }}>
            {qs.computed !== null ? scoreLabel(qs.computed) : 'No data'}
          </span>
        </div>
        <p className="modal-evidence">{evidence}</p>
        {sources.map((source, i) => (
          <div key={i} className="modal-source">
            {source.url ? (
              <>Source: <a href={source.url} target="_blank" rel="noopener noreferrer">↗ {source.title || source.url}</a></>
            ) : (
              <>Source: {source.title}</>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
