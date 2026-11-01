import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, Button, Field, TextInput } from './ui'
import { AuthApiError, resetPassword } from '../lib/authApi'
import { isBlank } from '../lib/validation'

const PASSWORD_MIN_LENGTH = 8

interface ResetPasswordParams {
  token: string | null
  email: string | null
}

function readResetPasswordParams(): ResetPasswordParams {
  const params = new URLSearchParams(window.location.search)

  return {
    token: params.get('token'),
    email: params.get('email'),
  }
}

export function ResetPasswordForm({
  onSignIn,
}: {
  onSignIn: () => void
}) {
  const [params] = useState(readResetPasswordParams)
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function validate(): boolean {
    const next: Record<string, string> = {}

    if (isBlank(password)) {
      next.password = 'The password field is required.'
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      next.password = `The password must be at least ${PASSWORD_MIN_LENGTH} characters.`
    }

    if (isBlank(passwordConfirmation)) {
      next.password_confirmation =
        'The password confirmation field is required.'
    } else if (password !== passwordConfirmation) {
      next.password_confirmation = 'The password confirmation does not match.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (
      isSubmitting ||
      !validate() ||
      params.token === null ||
      params.email === null
    ) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await resetPassword(
        params.token,
        params.email,
        password,
        passwordConfirmation,
      )
      setMessage(response.message)
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message)
      } else {
        setError('Unable to connect to the server.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (params.token === null || params.email === null) {
    return (
      <div className="ui-form">
        <h2>Reset password</h2>

        <p className="muted">
          This password reset link is invalid. Please request a new link from
          the sign in page.
        </p>

        <Button variant="secondary" onClick={onSignIn}>
          Sign in
        </Button>
      </div>
    )
  }

  if (message !== null) {
    return (
      <div className="ui-form">
        <h2>Password reset</h2>

        <p className="muted">
          {message} You can now sign in with your new password.
        </p>

        <Button variant="secondary" onClick={onSignIn}>
          Sign in
        </Button>
      </div>
    )
  }

  return (
    <form className="ui-form" onSubmit={handleSubmit} noValidate>
      <h2>Reset password</h2>

      <p className="muted">
        Enter a new password for <strong>{params.email}</strong>.
      </p>

      {error && <Alert tone="danger">{error}</Alert>}

      <Field
        id="reset-password"
        label="New password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        error={errors.password}
      >
        <TextInput
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />
      </Field>

      <Field
        id="reset-password-confirmation"
        label="Confirm new password"
        error={errors.password_confirmation}
      >
        <TextInput
          type="password"
          value={passwordConfirmation}
          onChange={(event) => setPasswordConfirmation(event.target.value)}
          autoComplete="new-password"
        />
      </Field>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Resetting…' : 'Reset password'}
      </Button>
    </form>
  )
}
