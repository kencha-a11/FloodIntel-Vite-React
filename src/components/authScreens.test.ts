import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const AUTH_COMPONENTS = [
  'LoginForm.tsx',
  'ForgotPasswordForm.tsx',
  'ResetPasswordForm.tsx',
  'EmailVerificationPrompt.tsx',
  'EmailVerificationResult.tsx',
  'TokenManager.tsx',
]

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('auth screens', () => {
  it.each(AUTH_COMPONENTS)('%s uses the primitives and no auth-only class', (file) => {
    const source = read(`./${file}`)

    expect(source).toContain("from './ui'")
    expect(source).not.toContain('auth-card')
    expect(source).not.toContain('auth-form')
    expect(source).not.toContain('className="switch"')
  })

  it('keeps the signed-out frames on the shell', () => {
    const app = read('../App.tsx')

    expect(app).toContain('<AuthShell>')
    expect(app).not.toContain('auth-card')
    expect(app).not.toContain('id="center"')
  })

  it('no longer defines the one-off auth CSS', () => {
    const css = read('../App.css')

    expect(css).not.toContain('.auth-card')
    expect(css).not.toContain('.auth-form')
    expect(css).not.toContain('#center')
    expect(css).not.toContain('.switch')
  })
})
