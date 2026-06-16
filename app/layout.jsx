import './globals.css'

export const metadata = {
  title: 'Senate AI Policy Tracker',
  description: 'Track U.S. Senate positions on AI policy for 2026 incumbents',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
