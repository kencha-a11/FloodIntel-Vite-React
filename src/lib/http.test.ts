import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthApiError, getStoredToken, request } from './http'

const stored = new Map<string, string>()

function respondOnce(status: number, headers: Record<string, string> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{"message":"Too Many Attempts."}', { status, headers })),
  )
}

beforeEach(() => {
  stored.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, value),
    removeItem: (key: string) => void stored.delete(key),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('request', () => {
  it('surfaces a 429 with Retry-After and keeps the session', async () => {
    localStorage.setItem('auth_token', 'secret-token')
    respondOnce(429, { 'Retry-After': '42' })

    const error = await request('/api/user').catch((err: unknown) => err)

    expect(error).toBeInstanceOf(AuthApiError)
    expect((error as AuthApiError).status).toBe(429)
    expect((error as AuthApiError).retryAfter).toBe(42)
    expect(getStoredToken()).toBe('secret-token')
  })

  it('reports a 401 as its own status so the caller can tell it from a wait', async () => {
    localStorage.setItem('auth_token', 'secret-token')
    respondOnce(401)

    const error = await request('/api/user').catch((err: unknown) => err)

    expect((error as AuthApiError).status).toBe(401)
    expect((error as AuthApiError).retryAfter).toBeNull()
  })

  it('reads the server clock off a rejected response', async () => {
    respondOnce(422, { Date: 'Wed, 21 Oct 2026 02:00:00 GMT' })

    const error = await request('/api/flood-reports').catch(
      (err: unknown) => err,
    )

    expect((error as AuthApiError).serverDate).toBe(
      Date.parse('Wed, 21 Oct 2026 02:00:00 GMT'),
    )
  })

  it('leaves the server clock unknown when the header is missing or malformed', async () => {
    respondOnce(422, { Date: 'not-a-date' })

    const malformed = await request('/api/flood-reports').catch(
      (err: unknown) => err,
    )

    expect((malformed as AuthApiError).serverDate).toBeNull()

    respondOnce(422)

    const absent = await request('/api/flood-reports').catch(
      (err: unknown) => err,
    )

    expect((absent as AuthApiError).serverDate).toBeNull()
  })
})
