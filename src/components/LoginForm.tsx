import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/useAuth'
import { formatDuration } from '../lib/format'
import { isBlank } from '../lib/validation'

export function LoginForm({
  onSwitch,
  onForgotPassword,
}: {
  onSwitch: () => void
  onForgotPassword: () => void
}) {
  const { login, error, fieldErrors, clearError, lockoutSeconds } =
    useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  function validate(): boolean {
    const next: Record<string, string> = {}

    if (isBlank(identifier)) {
      next.identifier = 'The email or contact number field is required.'
    }

    if (isBlank(password)) {
      next.password = 'The password field is required.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearError()

    if (isSubmitting || lockoutSeconds > 0 || !validate()) {
      return
    }

    setIsSubmitting(true)
    await login(identifier.trim(), password)
    setIsSubmitting(false)
  }

  const identifierError =
    errors.identifier ?? fieldErrors.login?.[0] ?? fieldErrors.identifier?.[0]
  const passwordError = errors.password ?? fieldErrors.password?.[0]

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <h2>Sign in</h2>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <label className="field">
        <span>Email or contact number</span>
        <input
          type="text"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
        />
        {identifierError && (
          <small className="field-error">{identifierError}</small>
        )}
      </label>

      <label className="field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
        {passwordError && (
          <small className="field-error">{passwordError}</small>
        )}
      </label>

      <button type="submit" disabled={isSubmitting || lockoutSeconds > 0}>
        {lockoutSeconds > 0
          ? `Try again in ${formatDuration(lockoutSeconds)}`
          : isSubmitting
            ? 'Signing in…'
            : 'Sign in'}
      </button>

      <p className="switch">
        <button type="button" className="link" onClick={onForgotPassword}>
          Forgot password?
        </button>
      </p>

      <p className="switch">
        New here?{' '}
        <button type="button" className="link" onClick={onSwitch}>
          Create an account
        </button>
      </p>
    </form>
  )
}
