import { useState } from 'react'
import { useAuth } from './context/useAuth'
import { EmailVerificationResult } from './components/EmailVerificationResult'
import { EmailVerificationPrompt } from './components/EmailVerificationPrompt'
import { ForgotPasswordForm } from './components/ForgotPasswordForm'
import { ResetPasswordForm } from './components/ResetPasswordForm'
import { TokenManager } from './components/TokenManager'
import { LoginForm } from './components/LoginForm'
import { readEmailVerificationStatus } from './lib/emailVerification'
import './App.css'

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
  const [showTokens, setShowTokens] = useState(false)

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

  if (showTokens) {
    return (
      <section id="center">
        <div className="auth-card">
          <TokenManager onBack={() => setShowTokens(false)} />
        </div>
      </section>
    )
  }

  return (
    <section id="center">
      <div className="auth-card">
        <h1>Welcome, {user.first_name} {user.last_name}</h1>
        <p>Signed in as {user.email}</p>
        <div className="welcome-actions">
          <button
            type="button"
            className="counter"
            onClick={() => setShowTokens(true)}
          >
            API tokens
          </button>
          <button type="button" className="counter" onClick={logout}>
            Log out
          </button>
        </div>
      </div>
    </section>
  )
}

export default App
