import type { RoleAccessRow } from '../types/auth'
import { API_BASE_URL, request } from './http'

/**
 * The role-and-ability matrix the server enforces (FR-105, D-114).
 *
 * Read-only: the catalogue is closed, so no client path writes a grant.
 */
export function listRoles(token: string): Promise<RoleAccessRow[]> {
  return request<{ data: RoleAccessRow[] }>(`${API_BASE_URL}/roles`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => response.data)
}
