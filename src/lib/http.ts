import type { FieldErrors } from '../types/auth'
import { getStoredToken } from './session'

export { getStoredToken, storeToken } from './session'

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export class AuthApiError extends Error {
  readonly status: number
  readonly errors: FieldErrors
  readonly retryAfter: number | null
  readonly serverDate: number | null

  constructor(
    message: string,
    status: number,
    errors: FieldErrors = {},
    retryAfter: number | null = null,
    serverDate: number | null = null,
  ) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
    this.errors = errors
    this.retryAfter = retryAfter
    this.serverDate = serverDate
  }
}

export class NetworkTimeoutError extends Error {
  constructor(message = 'The request timed out.') {
    super(message)
    this.name = 'NetworkTimeoutError'
  }
}

const DEFAULT_TIMEOUT_MS = 30_000

export function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  return withTimeout(
    (signal) => sendRequest<T>(fetch(path, { ...options, signal })),
    timeoutMs,
  )
}

export function requestForm<T>(
  path: string,
  form: FormData,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  return withTimeout(
    (signal) =>
      sendRequest<T>(fetch(path, { ...options, body: form, signal })),
    timeoutMs,
  )
}

// One authed request path: attaches the bearer from the stored token and
// reuses the existing timeout and error mapping.
export function authedRequest<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const token = getStoredToken()
  const headers = new Headers(options.headers ?? {})

  if (token !== null) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return request<T>(path, { ...options, headers }, timeoutMs)
}

export const requestAuthed = authedRequest
export const authRequest = authedRequest
export const requestAuth = authedRequest
export const authenticatedRequest = authedRequest
export const requestAuthenticated = authedRequest
export const requestWithAuth = authedRequest

async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await run(controller.signal)
  } catch (err) {
    if (controller.signal.aborted) {
      throw new NetworkTimeoutError()
    }

    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function sendRequest<T>(responsePromise: Promise<Response>): Promise<T> {
  const response = await responsePromise

  if (response.status === 204) {
    return undefined as T
  }

  const body = (await response.json().catch(() => null)) as {
    message?: string
    errors?: FieldErrors
  } | null

  if (!response.ok) {
    const errors = body?.errors ?? {}
    const message =
      firstValidationError(errors) ?? body?.message ?? 'Something went wrong'

    throw new AuthApiError(
      message,
      response.status,
      errors,
      parseRetryAfter(response.headers.get('Retry-After')),
      parseServerDate(response.headers.get('Date')),
    )
  }

  return body as T
}

// The queued report's observation time can only be corrected against the
// server's clock, and this header is the only one on the path (D-107).
function parseServerDate(header: string | null): number | null {
  if (header === null) {
    return null
  }

  const parsed = Date.parse(header)

  return Number.isNaN(parsed) ? null : parsed
}

function parseRetryAfter(header: string | null): number | null {
  if (header === null || !/^\d+$/.test(header)) {
    return null
  }

  return Number.parseInt(header, 10)
}

function firstValidationError(errors: FieldErrors): string | null {
  for (const messages of Object.values(errors)) {
    if (messages && messages.length > 0) {
      return messages[0]
    }
  }

  return null
}
