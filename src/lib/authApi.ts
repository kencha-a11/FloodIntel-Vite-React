import type {
  ApiToken,
  AuthResponse,
  CreateTokenResponse,
  FieldErrors,
  User,
} from '../types/auth'

const TOKEN_KEY = 'auth_token'
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, options)

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

export function login(
  identifier: string,
  password: string,
): Promise<AuthResponse> {
  return request<AuthResponse>(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: identifier, password }),
  })
}

export function fetchUser(token: string): Promise<User> {
  return request<User>(`${API_BASE_URL}/user`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function logout(token: string): Promise<void> {
  return request<void>(`${API_BASE_URL}/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function resendVerification(
  token: string,
): Promise<{ message: string }> {
  return request<{ message: string }>(
    `${API_BASE_URL}/email/verification-notification`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  )
}

export function forgotPassword(
  email: string,
): Promise<{ message: string }> {
  return request<{ message: string }>(`${API_BASE_URL}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

export function resetPassword(
  token: string,
  email: string,
  password: string,
  passwordConfirmation: string,
): Promise<{ message: string }> {
  return request<{ message: string }>(`${API_BASE_URL}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      email,
      password,
      password_confirmation: passwordConfirmation,
    }),
  })
}

export function listTokens(token: string): Promise<ApiToken[]> {
  return request<{ data: ApiToken[] }>(`${API_BASE_URL}/tokens`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => response.data)
}

export function createToken(
  token: string,
  name: string,
  abilities: string[] = [],
): Promise<CreateTokenResponse> {
  const payload =
    abilities.length > 0 ? { name, abilities } : { name }

  return request<CreateTokenResponse>(`${API_BASE_URL}/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
}

export function deleteToken(token: string, id: number): Promise<void> {
  return request<void>(`${API_BASE_URL}/tokens/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function deleteAllTokens(token: string): Promise<void> {
  return request<void>(`${API_BASE_URL}/tokens`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}
