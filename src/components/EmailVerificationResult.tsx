import { useEffect } from 'react'
import { Button } from './ui'
import { useAuth } from '../context/useAuth'
import {
  clearEmailVerificationStatus,
} from '../lib/emailVerification'
import type { EmailVerificationStatus } from '../lib/emailVerification'

export function EmailVerificationResult({
  status,
  onDismiss,
}: {
  status: EmailVerificationStatus
  onDismiss: () => void
}) {
  const { refreshUser } = useAuth()

  useEffect(() => {
    if (status === 'verified') {
      void refreshUser()
    }
  }, [status, refreshUser])

  useEffect(() => {
    clearEmailVerificationStatus()
  }, [])

  return (
    <div className="ui-form">
      <h2>{status === 'verified' ? 'Email verified' : 'Verification failed'}</h2>

      <p className="muted">
        {status === 'verified'
          ? 'Your email address has been verified successfully.'
          : 'This verification link is invalid or has expired. Please request a new link to verify your email address.'}
      </p>

      <Button variant="secondary" onClick={onDismiss}>
        Continue
      </Button>
    </div>
  )
}
