import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, Button, Field, TextInput } from './ui'
import { useAuth } from '../context/useAuth'
import { formatDuration } from '../lib/format'
import { isBlank } from '../lib/validation'

export function LoginForm({
  onForgotPassword,
}: {
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
    <form className="ui-form" onSubmit={handleSubmit} noValidate>
      <h2>Sign in</h2>

      {lockoutSeconds > 0 ? (
        <Alert tone="warning" role="status">
          Too many sign-in attempts. Try again in{' '}
          {formatDuration(lockoutSeconds)}.
        </Alert>
      ) : (
        error && <Alert tone="danger">{error}</Alert>
      )}

      <Field
        id="login-identifier"
        label="Email or contact number"
        error={identifierError}
      >
        <TextInput
          type="text"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
        />
      </Field>

      <Field id="login-password" label="Password" error={passwordError}>
        <TextInput
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </Field>

      <Button type="submit" disabled={isSubmitting || lockoutSeconds > 0}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>

      <Button variant="quiet" onClick={onForgotPassword}>
        Forgot password?
      </Button>

      <p className="muted">
        Accounts are created by your MDRRMO administrator. Contact them if you
        need access.
      </p>
    </form>
  )
}
