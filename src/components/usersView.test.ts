import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

/*
 * AUTHZ-11: role assignment is a client path to a server capability that
 * already exists. These guards pin that the screen reads the accounts and the
 * published roles from the server, writes only the role, refuses its own row,
 * shows the server's barangay refusal, and says the change is not audited.
 */

describe('users screen', () => {
  it('loads the accounts and the published role list on mount', () => {
    const view = read('./UsersView.tsx')

    expect(view).toContain('useEffect(')
    expect(view).toContain('listUsers(token, page)')
    expect(view).toContain('listRoles(token)')
    expect(view).toContain('Promise.all([')
    expect(view).toContain('getStoredToken()')
  })

  it('drops the session when the server refuses the read', () => {
    const view = read('./UsersView.tsx')

    expect(view).toContain('err instanceof AuthApiError && err.status === 401')
    expect(view).toContain('await logout()')
  })

  it('assigns through the existing endpoint with the role alone', () => {
    const view = read('./UsersView.tsx')
    const api = read('../lib/userApi.ts')

    expect(view).toContain('updateUserRole(token, account.id, role)')
    expect(view).not.toContain('<form')
    expect(api).toContain('body: JSON.stringify({ role })')
    expect(api).toContain('method: \'PATCH\'')
  })

  it('offers no control for the viewer\'s own account', () => {
    const view = read('./UsersView.tsx')

    expect(view).toContain('const isSelf = account.id === user?.id')
    expect(view).toContain('{isSelf ? (')
    expect(view).toContain('Your own role is refused by the server')
  })

  it('names the server\'s barangay refusal instead of a generic error', () => {
    const view = read('./UsersView.tsx')

    expect(view).toContain('err.errors.barangay_id?.[0] ?? err.message')
  })

  it('says a role change is not yet audited', () => {
    const view = read('./UsersView.tsx')

    expect(view).toContain('not yet written to a security log')
    expect(view).toContain('FR-102 is')
    expect(view).toContain('<Alert tone="warning">')
  })

  it('renders through the shared primitives', () => {
    const view = read('./UsersView.tsx')

    expect(view).toContain('<Spinner label="Loading accounts…" />')
    expect(view).toContain('<EmptyState')
    expect(view).toContain('<Alert tone="danger">{error}</Alert>')
    expect(view).toContain('<Badge tone="neutral">{account.role_label}</Badge>')
    expect(view).toContain('<Field')
    expect(view).toContain('<Select')
    expect(view).toContain('aria-label={`Save role for ${account.full_name}`}')
  })

  it('renders only behind the manage-users section', () => {
    const app = read('../App.tsx')
    const access = read('../lib/viewAccess.ts')

    expect(app).toContain("{activeView === 'users' && <UsersView />}")
    expect(access).toContain('if (permissions.manageUsers) {')
    expect(access).toContain("reachable.add('users')")
    expect(access).toContain("return 'Users'")
  })
})
