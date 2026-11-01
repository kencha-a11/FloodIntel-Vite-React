import { afterEach, describe, expect, it, vi } from 'vitest'
import { listRoles } from './rolesApi'
import { AuthApiError } from './http'
import type { RoleAccessRow } from '../types/auth'

const ROW: RoleAccessRow = {
  value: 'mdrrmo_officer',
  label: 'MDRRMO Officer',
  interface: { value: 'command_center', label: 'Command center' },
  barangay_scoped: false,
  abilities: [{ value: 'manage-users', label: 'Manage users' }],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listRoles', () => {
  it('reads the matrix with the session token and unwraps the data envelope', async () => {
    let path: string | null = null
    let headers: HeadersInit | undefined

    vi.stubGlobal(
      'fetch',
      vi.fn(async (requested: string, init: RequestInit = {}) => {
        path = requested
        headers = init.headers

        return new Response(JSON.stringify({ data: [ROW] }), { status: 200 })
      }),
    )

    await expect(listRoles('token')).resolves.toEqual([ROW])
    expect(path).toBe('/api/roles')
    expect(headers).toEqual({ Authorization: 'Bearer token' })
  })

  it('surfaces the server refusal with its status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'This action is unauthorized.' }), {
            status: 403,
          }),
      ),
    )

    await expect(listRoles('token')).rejects.toMatchObject({
      name: 'AuthApiError',
      status: 403,
      message: 'This action is unauthorized.',
    })
    await expect(listRoles('token')).rejects.toBeInstanceOf(AuthApiError)
  })
})
