import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthApiError, forgotPassword } from '../lib/authApi'
import { isBlank, isEmail } from '../lib/validation'

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function validate(): boolean {
    const next: Record<string, string> = {}

    if (isBlank(email)) {
      next.email = 'The email field is required.'
    } else if (!isEmail(email)) {
      next.email = 'The email must be a valid email address.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (isSubmitting || !validate()) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await forgotPassword(email.trim())
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

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <h2>Forgot password</h2>

      <p className="muted">
        Enter the email address associated with your account and we will send
        you a password reset link.
      </p>

      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
        {errors.email && (
          <small className="field-error">{errors.email}</small>
        )}
      </label>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </button>

      <p className="switch">
        <button type="button" className="link" onClick={onBack}>
          Back to sign in
        </button>
      </p>
    </form>
  )
}
