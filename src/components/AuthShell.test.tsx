import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AuthShell } from './AuthShell'

function render(): string {
  return renderToStaticMarkup(
    <AuthShell>
      <h2>Sign in</h2>
    </AuthShell>,
  )
}

describe('AuthShell', () => {
  it('puts the skip link first and points it at the focusable main landmark', () => {
    const html = render()

    expect(
      html.startsWith('<div class="auth-shell"><a class="skip-link" href="#main-content">'),
    ).toBe(true)
    expect(html).toContain('<main id="main-content" tabindex="-1"')
  })

  it('renders one product heading and the screen inside a card', () => {
    const html = render()

    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain('<h1>FloodIntel</h1>')
    expect(html).toContain('<section class="ui-card">')
    expect(html).toContain('<h2>Sign in</h2>')
  })

  it('keeps the screen inside the main landmark', () => {
    const html = render()
    const mainStart = html.indexOf('<main id="main-content"')
    const mainEnd = html.indexOf('</main>')
    const screen = html.indexOf('<h2>Sign in</h2>')

    expect(screen).toBeGreaterThan(mainStart)
    expect(screen).toBeLessThan(mainEnd)
  })
})
