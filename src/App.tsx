import { useState } from 'react'
import { useAuth } from './context/useAuth'
import { LoginForm } from './components/LoginForm'
import { RegisterForm } from './components/RegisterForm'
import './App.css'

function App() {
  const { user, isLoading, logout } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')

  if (isLoading) {
    return (
      <section id="center">
        <p>Loading…</p>
      </section>
    )
  }

  if (user === null) {
    return (
      <section id="center">
        <div className="auth-card">
          {mode === 'login' ? (
            <LoginForm onSwitch={() => setMode('register')} />
          ) : (
            <RegisterForm onSwitch={() => setMode('login')} />
          )}
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
