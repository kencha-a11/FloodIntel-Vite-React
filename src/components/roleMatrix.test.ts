import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

/*
 * D-114: the matrix is a read-only projection of the enum. These guards pin
 * that the screen fetches it rather than holding a copy, offers no write
 * control, and stays behind the manage-users section.
 */

describe('role matrix screen', () => {
  it('loads the matrix from the server on mount', () => {
    const view = read('./RoleMatrixView.tsx')

    expect(view).toContain('useEffect(')
    expect(view).toContain('listRoles(token)')
    expect(view).toContain('authApi.getStoredToken()')
  })

  it('drops the session when the server refuses the read', () => {
    const view = read('./RoleMatrixView.tsx')

    expect(view).toContain('err instanceof authApi.AuthApiError && err.status === 401')
    expect(view).toContain('await logout()')
  })

  it('offers no way to edit a grant', () => {
    const view = read('./RoleMatrixView.tsx')

    expect(view).not.toContain('<form')
    expect(view).not.toContain('<input')
    expect(view).not.toContain('<select')
    expect(view).not.toContain('<button type="submit"')
    expect(view).toContain('Read-only reference.')
  })

  it('renders each role through the shared primitives', () => {
    const view = read('./RoleMatrixView.tsx')

    expect(view).toContain('<Card className="role-card">')
    expect(view).toContain('<Badge tone="info">{role.interface.label}</Badge>')
    expect(view).toContain('<Spinner label="Loading roles…" />')
    expect(view).toContain('<EmptyState')
    expect(view).toContain('<Alert tone="danger">{error}</Alert>')
  })

  it('renders only behind the manage-users section', () => {
    const app = read('../App.tsx')
    const access = read('../lib/viewAccess.ts')

    expect(app).toContain("{activeView === 'roles' && <RoleMatrixView />}")
    expect(access).toContain('if (permissions.manageUsers) {')
    expect(access).toContain("reachable.add('roles')")
  })
})
