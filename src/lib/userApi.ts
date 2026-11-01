import type { User, UserRole } from '../types/auth'
import type { Paginated } from '../types/report'
import { API_BASE_URL, request } from './http'

/**
 * Lists the accounts the caller may manage (FR-103). The server decides the
 * scope: `/users` sits in the officer-only group and behind `ManageUsers`.
 */
export function listUsers(
  token: string,
  page: number,
  perPage = 15,
): Promise<Paginated<User>> {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  })

  return request<Paginated<User>>(`${API_BASE_URL}/users?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

/**
 * Assigns one role to an account through the existing update endpoint
 * (FR-103). Only the role is sent, so no other field is mass-assigned from
 * this screen; the server still refuses a change to the caller's own role.
 */
export function updateUserRole(
  token: string,
  userId: number,
  role: UserRole,
): Promise<User> {
  return request<{ data: User }>(`${API_BASE_URL}/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role }),
  }).then((response) => response.data)
}
