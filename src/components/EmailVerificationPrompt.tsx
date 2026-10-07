import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/useAuth'
import type { ResendVerificationResult } from '../context/AuthContext'

const RESEND_COOLDOWN_SECONDS = 60

export function EmailVerificationPrompt() {
  const { user, resendVerification } = useAuth()
  const [result, setResult] = useState<ResendVerificationResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) {
      return
    }

    const timer = setTimeout(
      () => setCooldown((seconds) => seconds - 1),
      1000,
    )

    return () => clearTimeout(timer)
  }, [cooldown])

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting || cooldown > 0) {
      return
    }

    setIsSubmitting(true)
    const nextResult = await resendVerification()
    setResult(nextResult)
    setIsSubmitting(false)

    if (nextResult.status === 'sent') {
      setCooldown(RESEND_COOLDOWN_SECONDS)
    }
  }

  const isDisabled = isSubmitting || cooldown > 0

  return (
    <form className="auth-form" onSubmit={handleResend} noValidate>
      <h2>Verify your email</h2>

      <p className="muted">
        We sent a verification link to <strong>{user?.email}</strong>. Please
        check your inbox and click the link to verify your email address.
      </p>

      {result && (
        <p
          className={result.status === 'error' ? 'form-error' : 'form-success'}
          role="status"
        >
          {result.message}
        </p>
      )}

      <button type="submit" disabled={isDisabled}>
        {cooldown > 0
          ? `Resend link in ${cooldown}s`
          : isSubmitting
            ? 'Sending…'
            : 'Resend verification link'}
      </button>
    </form>
  )
}
