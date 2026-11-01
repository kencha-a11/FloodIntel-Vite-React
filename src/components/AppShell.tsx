import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './ui'
import type { AccessInterface, User } from '../types/auth'
import type { AppView, ViewSection } from '../lib/viewAccess'

interface AppShellProps {
  user: User
  activeView: AppView
  iface: AccessInterface
  sections: readonly ViewSection[]
  onNavigate: (view: AppView) => void
  onLogout: () => void
  actions?: ReactNode
  children: ReactNode
}

function navVariant(isCurrent: boolean): 'primary' | 'secondary' {
  return isCurrent ? 'primary' : 'secondary'
}

function currentPage(isCurrent: boolean): 'page' | undefined {
  return isCurrent ? 'page' : undefined
}

export function AppShell({
  user,
  activeView,
  iface,
  sections,
  onNavigate,
  onLogout,
  actions,
  children,
}: AppShellProps) {
  const mainRef = useRef<HTMLElement>(null)
  const hasRendered = useRef(false)

  useEffect(() => {
    if (!hasRendered.current) {
      hasRendered.current = true
      return
    }

    mainRef.current?.focus({ preventScroll: true })
  }, [activeView])

  return (
    <div className="app-shell" data-interface={iface}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="app-shell-header">
        <div className="app-shell-identity">
          <h1>
            Welcome, {user.first_name} {user.last_name}
          </h1>
          <p className="muted">
            {user.role_label} ·{' '}
            {user.barangay !== null ? user.barangay.name : 'All barangays'}
          </p>
        </div>

        <div className="app-shell-actions">
          {actions}
          <Button variant="secondary" onClick={onLogout}>
            Log out
          </Button>
        </div>
      </header>

      <nav className="app-shell-nav" aria-label="Main sections">
        {sections.map((section) => (
          <Button
            key={section.view}
            variant={navVariant(activeView === section.view)}
            aria-current={currentPage(activeView === section.view)}
            onClick={() => onNavigate(section.view)}
          >
            {section.label}
          </Button>
        ))}
      </nav>

      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="app-shell-main"
      >
        {children}
      </main>
    </div>
  )
}
