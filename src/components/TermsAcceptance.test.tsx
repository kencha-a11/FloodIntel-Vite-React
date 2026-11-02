import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TermsAcceptance } from './TermsAcceptance'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('TermsAcceptance', () => {
  it('renders through the shared primitives with no auth-only class', () => {
    const html = renderToStaticMarkup(<TermsAcceptance />)

    expect(html).toContain('ui-card')
    expect(html).toContain('ui-checkbox')
    expect(html).not.toContain('auth-card')
    expect(html).not.toContain('auth-form')
  })

  it('uses the shared primitives as its source', () => {
    const source = read('./TermsAcceptance.tsx')

    expect(source).toContain("from './ui'")
  })

  it('renders the affirmative checkbox', () => {
    const html = renderToStaticMarkup(<TermsAcceptance />)

    expect(html).toContain('type="checkbox"')
    expect(html).toContain('I have read and accept the terms and conditions.')
  })
})
