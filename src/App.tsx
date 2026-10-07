import { useState } from 'react'
import { useAuth } from './context/useAuth'
import { EmailVerificationResult } from './components/EmailVerificationResult'
import { EmailVerificationPrompt } from './components/EmailVerificationPrompt'
import { ForgotPasswordForm } from './components/ForgotPasswordForm'
import { ResetPasswordForm } from './components/ResetPasswordForm'
import { LoginForm } from './components/LoginForm'
import { RegisterForm } from './components/RegisterForm'
import { readEmailVerificationStatus } from './lib/emailVerification'
import './App.css'

type AuthMode = 'login' | 'register' | 'forgot-password'

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
          ) : mode === 'login' ? (
            <LoginForm
              onSwitch={() => setMode('register')}
              onForgotPassword={() => setMode('forgot-password')}
            />
          ) : (
            <RegisterForm onSwitch={() => setMode('login')} />
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

  return (
    <section id="center">
      <div className="auth-card">
        <h1>Welcome, {user.first_name} {user.last_name}</h1>
        <p>Signed in as {user.email}</p>
        <button type="button" className="counter" onClick={logout}>
          Log out
        </button>
      </div>
    </section>
  )
}

export default App
