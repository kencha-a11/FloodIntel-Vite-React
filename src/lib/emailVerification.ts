export type EmailVerificationStatus =
  | 'verified'
  | 'verification-failed'

export function readEmailVerificationStatus(): EmailVerificationStatus | null {
  const params = new URLSearchParams(window.location.search)
  const status = params.get('email')

  return status === 'verified' || status === 'verification-failed'
    ? status
    : null
}

export function clearEmailVerificationStatus(): void {
  const params = new URLSearchParams(window.location.search)
  params.delete('email')
  const query = params.toString()

  window.history.replaceState(
    {},
    '',
    query.length > 0 ? `?${query}` : window.location.pathname,
  )
}
