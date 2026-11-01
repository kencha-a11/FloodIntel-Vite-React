import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './ui'
import type { User } from '../types/auth'

export type AppView =
  | 'capture'
  | 'impact'
  | 'reports'
  | 'detail'
  | 'map'
  | 'tokens'

interface AppShellProps {
  user: User
  activeView: AppView
  canSubmit: boolean
  canViewImpact: boolean
  canReview: boolean
  canViewMap: boolean
  canManageTokens: boolean
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
  canSubmit,
  canViewImpact,
  canReview,
  canViewMap,
  canManageTokens,
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

  // The detail view belongs to the review surface, so the queue item stays current.
  const current = activeView === 'detail' ? 'reports' : activeView

  return (
    <div className="app-shell">
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
        {canSubmit && (
          <Button
            variant={navVariant(current === 'capture')}
            aria-current={currentPage(current === 'capture')}
            onClick={() => onNavigate('capture')}
          >
            New report
          </Button>
        )}

        {canViewImpact && (
          <Button
            variant={navVariant(current === 'impact')}
            aria-current={currentPage(current === 'impact')}
            onClick={() => onNavigate('impact')}
          >
            Impact
          </Button>
        )}

        <Button
          variant={navVariant(current === 'reports')}
          aria-current={currentPage(current === 'reports')}
          onClick={() => onNavigate('reports')}
        >
          {canReview ? 'Review queue' : 'Reports'}
        </Button>

        {canViewMap && (
          <Button
            variant={navVariant(current === 'map')}
            aria-current={currentPage(current === 'map')}
            onClick={() => onNavigate('map')}
          >
            Map
          </Button>
        )}

        {canManageTokens && (
          <Button
            variant={navVariant(current === 'tokens')}
            aria-current={currentPage(current === 'tokens')}
            onClick={() => onNavigate('tokens')}
          >
            API tokens
          </Button>
        )}
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
