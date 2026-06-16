'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'

export default function EditorNav({ flagCount }) {
  const router = useRouter()
  const pathname = usePathname()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <nav className="nav-bar">
      <Link href="/" className="nav-brand">AI Policy Scorecard</Link>
      <Link href="/editor" className={`nav-link ${pathname === '/editor' ? 'active' : ''}`}>
        Candidates
      </Link>
      <Link href="/editor/flags" className={`nav-link ${pathname === '/editor/flags' ? 'active' : ''}`}>
        Flag Queue
        {flagCount > 0 && <span className="flag-badge">{flagCount}</span>}
      </Link>
      <div className="nav-spacer" />
      <button className="nav-logout" onClick={handleLogout}>Sign out</button>
    </nav>
  )
}
