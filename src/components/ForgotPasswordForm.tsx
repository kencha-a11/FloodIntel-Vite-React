import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, Button, Field, TextInput } from './ui'
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
    <form className="ui-form" onSubmit={handleSubmit} noValidate>
      <h2>Forgot password</h2>

      <p className="muted">
        Enter the email address associated with your account and we will send
        you a password reset link.
      </p>

      {message && <Alert tone="success">{message}</Alert>}

      {error && <Alert tone="danger">{error}</Alert>}

      <Field id="forgot-email" label="Email" error={errors.email}>
        <TextInput
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
      </Field>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </Button>

      <Button variant="quiet" onClick={onBack}>
        Back to sign in
      </Button>
    </form>
  )
}
