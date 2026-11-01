import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * The client runs vitest in a Node environment with no DOM, so the branch
 * structure of App.tsx cannot be asserted by rendering it. These guards pin
 * the one property the browser run then proves: every section renders from
 * the resolved view, never from the raw state, and the shell renders the
 * section list the access module produced (AUTHZ-07, D-112).
 */

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

const app = read('../App.tsx')
const shell = read('../components/AppShell.tsx')

describe('app section routing', () => {
  it('derives the section set and the active section from one module', () => {
    expect(app).toContain('viewAccess(user)')
    expect(app).toContain('resolveView(access, view)')
    expect(app).toContain('sections={access.sections}')
    expect(app).toContain('iface={access.iface}')
  })

  it('keys every section branch on the resolved view', () => {
    expect(app.match(/activeView === '\w+'/g)).toHaveLength(6)
    expect(app).toContain("{activeView === 'roles' && <RoleMatrixView />}")
    expect(app).not.toMatch(/\bview ===/)
  })

  it('keeps the old per-section flags out of the page', () => {
    for (const flag of [
      'canSubmit',
      'canViewImpact',
      'canViewMap',
      'canManageTokens',
    ]) {
      expect(app).not.toContain(flag)
    }
  })

  it('renders the navigation from the section list it is given', () => {
    expect(shell).toContain('sections.map(')
    expect(shell).toContain('data-interface={iface}')
  })
})
