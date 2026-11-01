import { describe, expect, it } from 'vitest'
import {
  NOT_RECORDED,
  describeAge,
  formatAbsoluteInstant,
  formatInstantWithAge,
} from './dateTime'

/*
 * Design §11 and §12: timestamps are absolute with timezone context, observed
 * and received are never merged, and the relative hint follows the absolute
 * one. Manila is UTC+8, so the expected strings are fixed values, not the
 * runner's zone.
 */

describe('formatAbsoluteInstant', () => {
  it('renders a readable Manila instant with its zone label', () => {
    expect(formatAbsoluteInstant('2026-11-02T10:00:00Z')).toBe(
      '02 Nov 2026, 6:00 PM PHT',
    )
  })

  it('crosses the date boundary with the zone it names', () => {
    expect(formatAbsoluteInstant('2026-11-01T16:30:00Z')).toBe(
      '02 Nov 2026, 12:30 AM PHT',
    )
  })

  it('states an absent or unparseable instant instead of showing a fake date', () => {
    expect(formatAbsoluteInstant(null)).toBe(NOT_RECORDED)
    expect(formatAbsoluteInstant('not-a-date')).toBe(NOT_RECORDED)
  })
})

describe('describeAge', () => {
  const now = new Date('2026-11-02T10:00:00Z')

  it('reports minutes, hours, and days', () => {
    expect(describeAge('2026-11-02T09:59:30Z', now)).toBe('just now')
    expect(describeAge('2026-11-02T09:30:00Z', now)).toBe('30 min ago')
    expect(describeAge('2026-11-02T07:00:00Z', now)).toBe('3 h ago')
    expect(describeAge('2026-10-31T10:00:00Z', now)).toBe('2 d ago')
  })

  it('does not invent a negative age for a future instant', () => {
    expect(describeAge('2026-11-02T10:05:00Z', now)).toBe('just now')
  })

  it('returns no hint for an unparseable instant', () => {
    expect(describeAge('not-a-date', now)).toBe('')
  })
})

describe('formatInstantWithAge', () => {
  it('keeps the absolute instant first and the age second', () => {
    expect(
      formatInstantWithAge('2026-11-02T09:30:00Z', new Date('2026-11-02T10:00:00Z')),
    ).toBe('02 Nov 2026, 5:30 PM PHT (30 min ago)')
  })
})
