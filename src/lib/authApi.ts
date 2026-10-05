import type { AuthResponse, FieldErrors, User } from '../types/auth'

const TOKEN_KEY = 'auth_token'

export class AuthApiError extends Error {
  readonly status: number
  readonly errors: FieldErrors

  constructor(message: string, status: number, errors: FieldErrors = {}) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
    this.errors = errors
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

    throw new AuthApiError(message, response.status, errors)
  }

  return body as T
}

function firstValidationError(errors: FieldErrors): string | null {
  for (const messages of Object.values(errors)) {
    if (messages && messages.length > 0) {
      return messages[0]
    }
  }

  return null
}

export function register(
  firstName: string,
  lastName: string,
  contactNumber: string,
  email: string,
  password: string,
  passwordConfirmation: string,
): Promise<AuthResponse> {
  return request<AuthResponse>('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      contact_number: contactNumber,
      email,
      password,
      password_confirmation: passwordConfirmation,
    }),
  })
}

export function login(
  identifier: string,
  password: string,
): Promise<AuthResponse> {
  return request<AuthResponse>('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: identifier, password }),
  })
}

export function fetchUser(token: string): Promise<User> {
  return request<User>('/api/user', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function logout(token: string): Promise<void> {
  return request<void>('/api/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}
