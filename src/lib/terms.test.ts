import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearTermsAcceptance,
  hasAcceptedTerms,
  markTermsAccepted,
} from './terms'

function memoryStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear: () => {
      store.clear()
    },
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('terms acceptance storage', () => {
  it('is false when no acceptance is stored', () => {
    vi.stubGlobal('localStorage', memoryStorage())

    expect(hasAcceptedTerms()).toBe(false)
  })

  it('is true after acceptance is marked', () => {
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)

    markTermsAccepted()

    expect(hasAcceptedTerms()).toBe(true)
    expect(storage.getItem('auth_terms_accepted')).not.toBeNull()
  })

  it('is false after acceptance is cleared', () => {
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)

    markTermsAccepted()
    clearTermsAcceptance()

    expect(hasAcceptedTerms()).toBe(false)
    expect(storage.getItem('auth_terms_accepted')).toBeNull()
  })

  it('is false for an invalid stored instant', () => {
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)

    storage.setItem('auth_terms_accepted', 'not-a-number')

    expect(hasAcceptedTerms()).toBe(false)
  })

  it('does not throw when no store is available', () => {
    expect(() => hasAcceptedTerms()).not.toThrow()
    expect(() => markTermsAccepted()).not.toThrow()
    expect(() => clearTermsAcceptance()).not.toThrow()
  })
})
