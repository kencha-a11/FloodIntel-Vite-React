import type {
  ApiToken,
  AuthResponse,
  CreateTokenResponse,
  Session,
  User,
} from '../types/auth'
import { API_BASE_URL, authedRequest, request } from './http'

export { AuthApiError, getStoredToken, storeToken } from './http'

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

export function fetchUser(_token: string): Promise<User> {
  return authedRequest<User>(`${API_BASE_URL}/user`)
}

export function logout(_token: string): Promise<void> {
  return authedRequest<void>(`${API_BASE_URL}/logout`, {
    method: 'POST',
  })
}

export function resendVerification(_token: string): Promise<{ message: string }> {
  return authedRequest<{ message: string }>(
    `${API_BASE_URL}/email/verification-notification`,
    {
      method: 'POST',
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

export function listTokens(_token: string): Promise<ApiToken[]> {
  return authedRequest<{ data: ApiToken[] }>(`${API_BASE_URL}/tokens`).then(
    (response) => response.data,
  )
}

export function fetchSessions(_token: string): Promise<Session[]> {
  return authedRequest<{ data: Session[] }>(`${API_BASE_URL}/sessions`).then(
    (response) => response.data,
  )
}

export function createToken(
  _token: string,
  name: string,
  abilities: string[] = [],
): Promise<CreateTokenResponse> {
  const payload =
    abilities.length > 0 ? { name, abilities } : { name }

  return authedRequest<CreateTokenResponse>(`${API_BASE_URL}/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function deleteToken(_token: string, id: number): Promise<void> {
  return authedRequest<void>(`${API_BASE_URL}/tokens/${id}`, {
    method: 'DELETE',
  })
}

export function deleteAllTokens(_token: string): Promise<void> {
  return authedRequest<void>(`${API_BASE_URL}/tokens`, {
    method: 'DELETE',
  })
}
