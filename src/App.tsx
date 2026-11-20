import { lazy, Suspense, useEffect, useState } from 'react'
import { useAuth } from './context/useAuth'
import { AppShell } from './components/AppShell'
import { AuthShell } from './components/AuthShell'
import { EmailVerificationResult } from './components/EmailVerificationResult'
import { EmailVerificationPrompt } from './components/EmailVerificationPrompt'
import { AccessTagList } from './components/AccessTagList'
import { FloodReportForm } from './components/FloodReportForm'
import { ImpactReportsView } from './components/ImpactReportsView'
import { ForgotPasswordForm } from './components/ForgotPasswordForm'
import { ResetPasswordForm } from './components/ResetPasswordForm'
import { ReviewWorkspace } from './components/ReviewWorkspace'
import { RoleMatrixView } from './components/RoleMatrixView'
import { SitrepWorkspace } from './components/SitrepWorkspace'
import { TokenManager } from './components/TokenManager'
import { UsersView } from './components/UsersView'
import { LoginForm } from './components/LoginForm'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'
import { QueueIndicator } from './components/QueueIndicator'
import { readEmailVerificationStatus } from './lib/emailVerification'
import {
  resolveView,
  viewAccess,
  type AppView,
} from './lib/viewAccess'
import './App.css'

const MapView = lazy(() => import('./components/MapView'))

type AuthMode = 'login' | 'forgot-password'

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

  const access = viewAccess(user)
  const activeView = resolveView(access, view)

  function navigate(next: AppView | null): void {
    setCorrectsReportId(null)
    setView(next)
  }

  return (
    <AppShell
      user={user}
      activeView={activeView}
      iface={access.iface}
      sections={access.sections}
      onNavigate={navigate}
      onLogout={logout}
      actions={<QueueIndicator />}
    >
      <PwaUpdatePrompt />

      {activeView === 'capture' && (
        <FloodReportForm
          correctsReportId={correctsReportId}
          canRecordTag={access.permissions.recordAccessTag}
          onCorrectionCleared={() => setCorrectsReportId(null)}
          onViewReports={() => setView('reports')}
        />
      )}

      {activeView === 'impact' && (
        <ImpactReportsView
          canFileImpact={access.permissions.fileImpactReport}
        />
      )}

      {activeView === 'reports' && (
        <ReviewWorkspace
          permissions={access.permissions}
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
          <MapView
            canViewValidatedFeed={access.permissions.viewValidatedFeed}
          />
        </Suspense>
      )}

      {activeView === 'tags' && (
        <AccessTagList permissions={access.permissions} />
      )}

      {activeView === 'tokens' && (
        <TokenManager onBack={() => setView(null)} />
      )}

      {activeView === 'roles' && <RoleMatrixView />}

      {activeView === 'users' && <UsersView />}

      {activeView === 'sitrep' && (
        <SitrepWorkspace canIssue={access.permissions.issueSitrep} />
      )}
    </AppShell>
  )
}

export default App
