import { useState } from 'react'
import { useAuth } from './context/useAuth'
import { EmailVerificationResult } from './components/EmailVerificationResult'
import { EmailVerificationPrompt } from './components/EmailVerificationPrompt'
import { FloodReportForm } from './components/FloodReportForm'
import { ForgotPasswordForm } from './components/ForgotPasswordForm'
import { ReportDetail } from './components/ReportDetail'
import { ReportList } from './components/ReportList'
import { ResetPasswordForm } from './components/ResetPasswordForm'
import { TokenManager } from './components/TokenManager'
import { LoginForm } from './components/LoginForm'
import { readEmailVerificationStatus } from './lib/emailVerification'
import './App.css'

type AuthMode = 'login' | 'forgot-password'
type AppView = 'capture' | 'reports' | 'detail' | 'tokens'

const ABILITY_SUBMIT_FLOOD_REPORT = 'submit-flood-report'
const ABILITY_VIEW_ALL_BARANGAYS = 'view-all-barangays'
const ABILITY_MANAGE_USERS = 'manage-users'

function isResetPasswordRoute(): boolean {
  return window.location.pathname.replace(/\/+$/, '') === '/reset-password'
}

function navClass(isActive: boolean): string {
  return isActive ? 'nav-button is-active' : 'nav-button'
}

function App() {
  const { user, isLoading, isEmailVerified, logout } = useAuth()
  const [verificationDismissed, setVerificationDismissed] = useState(false)
  const verificationStatus = verificationDismissed
    ? null
    : readEmailVerificationStatus()
  const [mode, setMode] = useState<AuthMode>('login')
  const [view, setView] = useState<AppView | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null)

  if (isLoading) {
    return (
      <section id="center">
        <p>Loading…</p>
      </section>
    )
  }

  if (verificationStatus !== null) {
    return (
      <EmailVerificationResult
        status={verificationStatus}
        onDismiss={() => setVerificationDismissed(true)}
      />
    )
  }

  if (isResetPasswordRoute()) {
    return (
      <section id="center">
        <div className="auth-card">
          <ResetPasswordForm
            onSignIn={() => {
              window.history.replaceState({}, '', '/')
              setMode('login')
            }}
          />
        </div>
      </section>
    )
  }

  if (user === null) {
    return (
      <section id="center">
        <div className="auth-card">
          {mode === 'forgot-password' ? (
            <ForgotPasswordForm onBack={() => setMode('login')} />
          ) : (
            <LoginForm onForgotPassword={() => setMode('forgot-password')} />
          )}
        </div>
      </section>
    )
  }

  if (!isEmailVerified) {
    return (
      <section id="center">
        <div className="auth-card">
          <EmailVerificationPrompt />
        </div>
      </section>
    )
  }

  const abilities = user.abilities ?? []
  const canSubmit = abilities.includes(ABILITY_SUBMIT_FLOOD_REPORT)
  const canReview =
    abilities.includes(ABILITY_VIEW_ALL_BARANGAYS) ||
    abilities.includes(ABILITY_MANAGE_USERS)
  const activeView = view ?? (canSubmit ? 'capture' : 'reports')

  return (
    <section id="center">
      <div className="auth-card app-card">
        <header className="app-header">
          <div>
            <h1>
              Welcome, {user.first_name} {user.last_name}
            </h1>
            <p className="muted">
              {user.role_label} ·{' '}
              {user.barangay !== null ? user.barangay.name : 'All barangays'}
            </p>
          </div>
          <button type="button" className="counter" onClick={logout}>
            Log out
          </button>
        </header>

        <nav className="app-nav">
          {canSubmit && (
            <button
              type="button"
              className={navClass(activeView === 'capture')}
              onClick={() => setView('capture')}
            >
              New report
            </button>
          )}

          <button
            type="button"
            className={navClass(activeView === 'reports')}
            onClick={() => setView('reports')}
          >
            {canReview ? 'Review queue' : 'Reports'}
          </button>

          <button
            type="button"
            className={navClass(activeView === 'tokens')}
            onClick={() => setView('tokens')}
          >
            API tokens
          </button>
        </nav>

        {activeView === 'capture' && canSubmit && (
          <FloodReportForm onViewReports={() => setView('reports')} />
        )}

        {activeView === 'reports' && (
          <ReportList
            canFilter={canReview}
            onSelect={(reportId) => {
              setSelectedReportId(reportId)
              setView('detail')
            }}
          />
        )}

        {activeView === 'detail' && selectedReportId !== null && (
          <ReportDetail
            reportId={selectedReportId}
            onBack={() => setView('reports')}
          />
        )}

        {activeView === 'tokens' && (
          <TokenManager onBack={() => setView(null)} />
        )}
      </div>
    </section>
  )
}

export default App
