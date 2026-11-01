import { describe, expect, it } from 'vitest'
import { isPageVisible, readVisibilityState } from './pageVisibility'

describe('isPageVisible', () => {
  it('treats only the hidden state as backgrounded', () => {
    expect(isPageVisible('hidden')).toBe(false)
    expect(isPageVisible('visible')).toBe(true)
    expect(isPageVisible('prerender')).toBe(true)
  })

  it('assumes a visible page when there is no document to read', () => {
    expect(isPageVisible(undefined)).toBe(true)
    expect(isPageVisible(readVisibilityState())).toBe(true)
  })
})
