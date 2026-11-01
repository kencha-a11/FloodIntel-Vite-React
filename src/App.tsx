import { lazy, Suspense, useEffect, useState } from 'react'
import { useAuth } from './context/useAuth'
import { AppShell, type AppView } from './components/AppShell'
import { AuthShell } from './components/AuthShell'
import { EmailVerificationResult } from './components/EmailVerificationResult'
import { EmailVerificationPrompt } from './components/EmailVerificationPrompt'
import { FloodReportForm } from './components/FloodReportForm'
import { ImpactReportsView } from './components/ImpactReportsView'
import { ForgotPasswordForm } from './components/ForgotPasswordForm'
import { ResetPasswordForm } from './components/ResetPasswordForm'
import { ReviewWorkspace } from './components/ReviewWorkspace'
import { TokenManager } from './components/TokenManager'
import { LoginForm } from './components/LoginForm'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'
import { QueueIndicator } from './components/QueueIndicator'
import { readEmailVerificationStatus } from './lib/emailVerification'
import './App.css'

const MapView = lazy(() => import('./components/MapView'))

type AuthMode = 'login' | 'forgot-password'

const ABILITY_SUBMIT_FLOOD_REPORT = 'submit-flood-report'
const ABILITY_SUBMIT_IMPACT_REPORT = 'submit-impact-report'
const ABILITY_VIEW_OWN_BARANGAY = 'view-own-barangay'
const ABILITY_VIEW_ALL_BARANGAYS = 'view-all-barangays'
const ABILITY_MANAGE_USERS = 'manage-users'
const ABILITY_VIEW_VALIDATED_REPORTS = 'view-validated-reports'

function isResetPasswordRoute(): boolean {
  return window.location.pathname.replace(/\/+$/, '') === '/reset-password'
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
  const [correctsReportId, setCorrectsReportId] = useState<number | null>(null)
  const userId = user?.id ?? null

  useEffect(() => {
    setView(null)
    setSelectedReportId(null)
    setCorrectsReportId(null)
  }, [userId])

  if (isLoading) {
    return (
      <AuthShell>
        <p>Loading…</p>
      </AuthShell>
    )
  }

  if (verificationStatus !== null) {
    return (
      <AuthShell>
        <EmailVerificationResult
          status={verificationStatus}
          onDismiss={() => setVerificationDismissed(true)}
        />
      </AuthShell>
    )
  }

  if (isResetPasswordRoute()) {
    return (
      <AuthShell>
        <ResetPasswordForm
          onSignIn={() => {
            window.history.replaceState({}, '', '/')
            setMode('login')
          }}
        />
      </AuthShell>
    )
  }

  if (user === null) {
    return (
      <AuthShell>
        {mode === 'forgot-password' ? (
          <ForgotPasswordForm onBack={() => setMode('login')} />
        ) : (
          <LoginForm onForgotPassword={() => setMode('forgot-password')} />
        )}
      </AuthShell>
    )
  }

  if (!isEmailVerified) {
    return (
      <AuthShell>
        <EmailVerificationPrompt />
      </AuthShell>
    )
  }

  const abilities = user.abilities ?? []
  const canSubmit = abilities.includes(ABILITY_SUBMIT_FLOOD_REPORT)
  const canFileImpact = abilities.includes(ABILITY_SUBMIT_IMPACT_REPORT)
  const canViewImpact =
    canFileImpact || abilities.includes(ABILITY_VIEW_OWN_BARANGAY)
  const canReview =
    abilities.includes(ABILITY_VIEW_ALL_BARANGAYS) ||
    abilities.includes(ABILITY_MANAGE_USERS)
  const canViewMap = abilities.includes(ABILITY_VIEW_VALIDATED_REPORTS)
  // UX convenience only; the server authorizes every token request (D-08).
  const canManageTokens = user.interface === 'command_center'
  const activeView = view ?? (canSubmit ? 'capture' : 'reports')

  function navigate(next: AppView | null): void {
    setCorrectsReportId(null)
    setView(next)
  }

  return (
    <AppShell
      user={user}
      activeView={activeView}
      canSubmit={canSubmit}
      canViewImpact={canViewImpact}
      canReview={canReview}
      canViewMap={canViewMap}
      canManageTokens={canManageTokens}
      onNavigate={navigate}
      onLogout={logout}
      actions={<QueueIndicator />}
    >
      <PwaUpdatePrompt />

      {activeView === 'capture' && canSubmit && (
        <FloodReportForm
          correctsReportId={correctsReportId}
          onCorrectionCleared={() => setCorrectsReportId(null)}
          onViewReports={() => setView('reports')}
        />
      )}

      {activeView === 'impact' && (
        <ImpactReportsView canFileImpact={canFileImpact} />
      )}

      {activeView === 'reports' && (
        <ReviewWorkspace
          canFilter={canReview}
          selectedReportId={selectedReportId}
          onSelect={setSelectedReportId}
          onClear={() => setSelectedReportId(null)}
          onCorrect={(reportId) => {
            setCorrectsReportId(reportId)
            setView('capture')
          }}
        />
      )}

      {activeView === 'map' && (
        <Suspense fallback={<p className="muted">Loading map…</p>}>
          <MapView canViewValidatedFeed={canViewMap} />
        </Suspense>
      )}

      {activeView === 'tokens' && canManageTokens && (
        <TokenManager onBack={() => setView(null)} />
      )}
    </AppShell>
  )
}

export default App
