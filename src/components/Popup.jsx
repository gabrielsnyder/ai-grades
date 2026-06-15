import { useEffect, useRef } from 'react'
import { QUESTIONS } from '../data/senators'

export default function Popup({ popup, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!popup) return
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
  }, [popup, onClose])

  if (!popup) return null

  const { senator, qIdx, anchorRect } = popup
  const s = senator.scores[qIdx]

  // Position: prefer right of anchor, fall back to left
  const PW = 380
  let left = anchorRect.right + 8
  let top = anchorRect.top + window.scrollY - 8
  if (left + PW > window.innerWidth - 12) left = anchorRect.left - PW - 8
  if (left < 8) left = 8
  const maxTop = document.documentElement.scrollHeight - 220
  if (top > maxTop) top = maxTop
  if (top < 8) top = 8

  return (
    <div
      ref={ref}
      className="popup"
      style={{ position: 'absolute', left, top, width: PW }}
    >
      <button className="popup-close" onClick={onClose} aria-label="Close">×</button>
      <h4>{senator.name} · Q{qIdx + 1}: {QUESTIONS[qIdx]}</h4>
      <p>{s.evidence || 'No publicly stated position found.'}</p>
      {s.url ? (
        <a href={s.url} target="_blank" rel="noopener noreferrer">↗ {s.source}</a>
      ) : s.source ? (
        <span className="popup-source-text">{s.source}</span>
      ) : null}
    </div>
  )
}
