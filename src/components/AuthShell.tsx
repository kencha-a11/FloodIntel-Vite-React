import type { ReactNode } from 'react'
import { Card } from './ui'

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="auth-shell-header">
        <h1>FloodIntel</h1>
      </header>

      <main id="main-content" tabIndex={-1} className="auth-shell-main">
        <Card>{children}</Card>
      </main>
    </div>
  )
}
