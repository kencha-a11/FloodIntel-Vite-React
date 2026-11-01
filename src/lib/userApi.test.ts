import { afterEach, describe, expect, it, vi } from 'vitest'
import { listUsers, updateUserRole } from './userApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listUsers', () => {
  it('asks for the page and the size, and nothing it does not filter', async () => {
    let path = ''

    vi.stubGlobal(
      'fetch',
      vi.fn(async (requestPath: string) => {
        path = requestPath

        return new Response(
          JSON.stringify({ data: [], meta: { current_page: 2 } }),
          { status: 200 },
        )
      }),
    )

    await listUsers('token', 2)

    expect(path).toContain('/users?')
    expect(path).toContain('page=2')
    expect(path).toContain('per_page=15')
    expect(path).not.toContain('role=')
    expect(path).not.toContain('barangay_id=')
  })
})

describe('updateUserRole', () => {
  it('patches the account with the role alone', async () => {
    let method = ''
    let body: unknown = null

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_path: string, init: RequestInit = {}) => {
        method = init.method ?? ''
        body = JSON.parse(String(init.body))

        return new Response(JSON.stringify({ data: { id: 7 } }), {
          status: 200,
        })
      }),
    )

    await updateUserRole('token', 7, 'barangay_captain')

    expect(method).toBe('PATCH')
    expect(body).toEqual({ role: 'barangay_captain' })
  })

  it('surfaces the server refusal on the named field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              message: 'The given data was invalid.',
              errors: {
                barangay_id: [
                  'A barangay is required for the selected role.',
                ],
              },
            }),
            { status: 422 },
          ),
      ),
    )

    await expect(
      updateUserRole('token', 7, 'barangay_captain'),
    ).rejects.toMatchObject({
      status: 422,
      errors: {
        barangay_id: ['A barangay is required for the selected role.'],
      },
    })
  })
})
