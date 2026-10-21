import type {
  ApiToken,
  AuthResponse,
  CreateTokenResponse,
  User,
} from '../types/auth'
import { API_BASE_URL, request } from './http'

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
