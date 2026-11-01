import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppShell, type AppView } from './AppShell'
import type { User } from '../types/auth'

const user: User = {
  id: 7,
  first_name: 'Ana',
  last_name: 'Reyes',
  full_name: 'Ana Reyes',
  contact_number: '09170000000',
  email: 'ana@example.test',
  email_verified_at: '2026-11-01T00:00:00Z',
  created_at: '2026-11-01T00:00:00Z',
  role: 'mdrrmo_officer',
  role_label: 'MDRRMO Officer',
  interface: 'command_center',
  abilities: [],
  barangay: null,
}

interface Overrides {
  activeView?: AppView
  canSubmit?: boolean
  canReview?: boolean
  canViewMap?: boolean
  canManageTokens?: boolean
}

function render(overrides: Overrides = {}): string {
  return renderToStaticMarkup(
    <AppShell
      user={user}
      activeView={overrides.activeView ?? 'reports'}
      canSubmit={overrides.canSubmit ?? true}
      canReview={overrides.canReview ?? true}
      canViewMap={overrides.canViewMap ?? true}
      canManageTokens={overrides.canManageTokens ?? true}
      onNavigate={() => {}}
      onLogout={() => {}}
      actions={<span>queue</span>}
    >
      <h2>Flood report queue</h2>
    </AppShell>,
  )
}

describe('AppShell', () => {
  it('puts the skip link first and points it at the focusable main landmark', () => {
    const html = render()

    expect(html.startsWith('<div class="app-shell"><a class="skip-link" href="#main-content">')).toBe(
      true,
    )
    expect(html).toContain('<main id="main-content" tabindex="-1"')
  })

  it('renders header, navigation, and main landmarks', () => {
    const html = render()

    expect(html).toContain('<header class="app-shell-header">')
    expect(html).toContain('<nav class="app-shell-nav" aria-label="Main sections">')
    expect(html).toContain('<main id="main-content"')
    expect(html).toContain('Welcome, Ana Reyes')
    expect(html).toContain('Log out')
    expect(html).toContain('<span>queue</span>')
  })

  it('marks exactly one section as the current page', () => {
    const html = render({ activeView: 'reports' })

    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).toContain('aria-current="page">Review queue</button>')
    expect(html).toContain('ui-button--primary" aria-current="page">Review queue')
  })

  it('keeps the review queue current while a report is open', () => {
    const html = render({ activeView: 'detail' })

    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).toContain('aria-current="page">Review queue</button>')
  })

  it('hides sections the account cannot reach and renames the list', () => {
    const html = render({ canSubmit: false, canReview: false, canViewMap: false })

    expect(html).not.toContain('New report')
    expect(html).not.toContain('>Map<')
    expect(html).toContain('>Reports<')
    expect(html).toContain('>API tokens<')
  })

  it('hides token management from field-facing accounts', () => {
    const html = render({ canManageTokens: false })

    expect(html).not.toContain('>API tokens<')
  })

  it('renders the active view inside the main landmark', () => {
    const html = render()
    const mainStart = html.indexOf('<main id="main-content"')
    const mainEnd = html.indexOf('</main>')
    const view = html.indexOf('<h2>Flood report queue</h2>')

    expect(view).toBeGreaterThan(mainStart)
    expect(view).toBeLessThan(mainEnd)
  })
})
