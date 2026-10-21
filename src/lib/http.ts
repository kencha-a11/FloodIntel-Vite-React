import type { FieldErrors } from '../types/auth'

const TOKEN_KEY = 'auth_token'

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export class AuthApiError extends Error {
  readonly status: number
  readonly errors: FieldErrors
  readonly retryAfter: number | null

  constructor(
    message: string,
    status: number,
    errors: FieldErrors = {},
    retryAfter: number | null = null,
  ) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
    this.errors = errors
    this.retryAfter = retryAfter
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string | null): void {
  if (token === null) {
    localStorage.removeItem(TOKEN_KEY)
  } else {
    localStorage.setItem(TOKEN_KEY, token)
  }
}

export function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return sendRequest<T>(fetch(path, options))
}

export function requestForm<T>(
  path: string,
  form: FormData,
  options: RequestInit = {},
): Promise<T> {
  return sendRequest<T>(fetch(path, { ...options, body: form }))
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
    )
  }

  return body as T
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
