import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppShell } from './AppShell'
import type { AppView, ViewSection } from '../lib/viewAccess'
import type { AccessInterface, User } from '../types/auth'

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

const COMMAND_SECTIONS: ViewSection[] = [
  { view: 'reports', label: 'Review queue' },
  { view: 'map', label: 'Map' },
  { view: 'tokens', label: 'API tokens' },
]

const FIELD_SECTIONS: ViewSection[] = [
  { view: 'capture', label: 'New report' },
  { view: 'impact', label: 'Impact' },
  { view: 'reports', label: 'Reports' },
]

interface Overrides {
  activeView?: AppView
  iface?: AccessInterface
  sections?: ViewSection[]
}

function render(overrides: Overrides = {}): string {
  return renderToStaticMarkup(
    <AppShell
      user={user}
      activeView={overrides.activeView ?? 'reports'}
      iface={overrides.iface ?? 'command_center'}
      sections={overrides.sections ?? COMMAND_SECTIONS}
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

    expect(
      html.startsWith(
        '<div class="app-shell" data-interface="command_center"><a class="skip-link" href="#main-content">',
      ),
    ).toBe(true)
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

  it('names the interface the account signed in with', () => {
    expect(render({ iface: 'command_center' })).toContain(
      'data-interface="command_center"',
    )
    expect(render({ iface: 'field_reporter' })).toContain(
      'data-interface="field_reporter"',
    )
  })

  it('marks exactly one section as the current page', () => {
    const html = render({ activeView: 'reports' })

    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).toContain('aria-current="page">Review queue</button>')
    expect(html).toContain('ui-button--primary" aria-current="page">Review queue')
  })

  it('renders only the sections it is given', () => {
    const html = render({ sections: FIELD_SECTIONS, iface: 'field_reporter' })

    expect(html).toContain('>New report<')
    expect(html).toContain('>Impact<')
    expect(html).toContain('>Reports<')
    expect(html).not.toContain('>Map<')
    expect(html).not.toContain('>API tokens<')
  })

  it('keeps the order the access module chose', () => {
    const html = render({ sections: FIELD_SECTIONS, iface: 'field_reporter' })

    expect(html.indexOf('>New report<')).toBeLessThan(html.indexOf('>Impact<'))
    expect(html.indexOf('>Impact<')).toBeLessThan(html.indexOf('>Reports<'))
  })

  it('shows the impact section and marks it current', () => {
    const html = render({ activeView: 'impact', sections: FIELD_SECTIONS })

    expect(html).toContain('aria-current="page">Impact</button>')
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
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
