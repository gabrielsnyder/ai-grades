'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'

export default function AdminLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div>
      <nav className="nav-bar">
        <Link href="/" className="nav-brand">AI Policy Tracker</Link>
        <Link href="/editor" className={pathname === '/editor' ? 'active' : ''}>Candidates</Link>
        <Link href="/admin" className={pathname === '/admin' ? 'active' : ''}>Admin</Link>
        <div className="nav-spacer" />
        <button className="nav-logout" onClick={handleLogout}>Sign out</button>
      </nav>
      {children}
    </div>
  )
}
