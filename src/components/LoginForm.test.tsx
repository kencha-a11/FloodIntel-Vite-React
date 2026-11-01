import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AuthContext, type AuthContextValue } from '../context/AuthContext'
import { LoginForm } from './LoginForm'

function render(overrides: Partial<AuthContextValue> = {}): string {
  const context: AuthContextValue = {
    user: null,
    isLoading: false,
    isEmailVerified: false,
    lockoutSeconds: 0,
    error: null,
    fieldErrors: {},
    login: async () => false,
    logout: async () => {},
    refreshUser: async () => {},
    resendVerification: async () => ({ status: 'sent', message: 'Sent.' }),
    clearError: () => {},
    ...overrides,
  }

  return renderToStaticMarkup(
    <AuthContext.Provider value={context}>
      <LoginForm onForgotPassword={() => {}} />
    </AuthContext.Provider>,
  )
}

describe('LoginForm', () => {
  it('renders the shared form primitives', () => {
    const html = render()

    expect(html).toContain('class="ui-form"')
    expect(html).toContain('ui-input')
    expect(html).toContain('ui-button--primary')
    expect(html).toContain('ui-button--quiet')
    expect(html).not.toContain('auth-form')
    expect(html).not.toContain('auth-card')
  })

  it('names the identifier for autofill without autocorrection', () => {
    const html = render()

    expect(html).toMatch(/autocomplete="username"/i)
    expect(html).toMatch(/autocapitalize="none"/i)
    expect(html).toMatch(/spellcheck="false"/i)
  })

  it('announces the lockout countdown politely and disables submit', () => {
    const html = render({ lockoutSeconds: 65 })

    expect(html).toContain('ui-alert--warning')
    expect(html).toContain('role="status"')
    expect(html).toContain('Try again in 1m 5s.')
    expect(html).toContain('>Sign in</button>')
    expect(html).toContain('disabled=""')
  })

  it('shows the server error as an alert when not locked out', () => {
    const html = render({
      error: 'These credentials do not match our records.',
    })

    expect(html).toContain('role="alert"')
    expect(html).toContain('These credentials do not match our records.')
    expect(html).not.toContain('Too many sign-in attempts.')
  })
})
