import { describe, expect, it } from 'vitest'
import { correctableReports, previousFamiliesFor, previousReportFor } from './impactApi'
import type { FloodImpactReport } from '../types/impact'

function report(overrides: Partial<FloodImpactReport>): FloodImpactReport {
  return {
    id: 1,
    user_id: 7,
    barangay_id: 3,
    event_id: 1,
    families: 10,
    individuals: 40,
    remarks: null,
    reported_at: '2026-11-01T08:00:00Z',
    status: 'submitted',
    supersedes_id: null,
    created_at: '2026-11-01T08:00:00Z',
    ...overrides,
  }
}

describe('previousFamiliesFor', () => {
  it('returns null without a selected event', () => {
    expect(previousFamiliesFor([report({})], null)).toBeNull()
  })

  it('returns null when the event has no reports yet', () => {
    expect(previousFamiliesFor([report({ event_id: 2 })], 1)).toBeNull()
  })

  it('reads the latest report for the selected event', () => {
    const reports = [
      report({ id: 1, families: 12, reported_at: '2026-11-01T08:00:00Z' }),
      report({ id: 2, families: 40, reported_at: '2026-11-01T12:00:00Z' }),
      report({ id: 3, families: 25, reported_at: '2026-11-01T10:00:00Z' }),
    ]

    expect(previousFamiliesFor(reports, 1)).toBe(40)
  })

  it('ignores reports filed against another event', () => {
    const reports = [
      report({ id: 1, event_id: 1, families: 12 }),
      report({ id: 2, event_id: 2, families: 99 }),
    ]

    expect(previousFamiliesFor(reports, 1)).toBe(12)
    expect(previousFamiliesFor(reports, 2)).toBe(99)
  })

  it('falls back to the creation time when reported_at is missing', () => {
    const reports = [
      report({
        id: 1,
        families: 12,
        reported_at: null,
        created_at: '2026-11-01T09:00:00Z',
      }),
      report({
        id: 2,
        families: 30,
        reported_at: null,
        created_at: '2026-11-01T07:00:00Z',
      }),
    ]

    expect(previousFamiliesFor(reports, 1)).toBe(12)
  })
})

describe('previousReportFor', () => {
  it('returns null without a selected event', () => {
    expect(previousReportFor([report({})], null)).toBeNull()
  })

  it('returns the report itself, not only its family count', () => {
    const latest = report({ id: 2, families: 40, reported_at: '2026-11-01T12:00:00Z' })
    const reports = [
      report({ id: 1, families: 12, reported_at: '2026-11-01T08:00:00Z' }),
      latest,
    ]

    expect(previousReportFor(reports, 1)).toBe(latest)
  })
})

describe('correctableReports', () => {
  it('returns nothing without a selected event', () => {
    expect(correctableReports([report({})], null)).toEqual([])
  })

  it('keeps only submitted reports for the selected event, newest first', () => {
    const reports = [
      report({ id: 1, status: 'superseded', reported_at: '2026-11-01T08:00:00Z' }),
      report({ id: 2, status: 'submitted', reported_at: '2026-11-01T09:00:00Z' }),
      report({ id: 3, status: 'submitted', reported_at: '2026-11-01T11:00:00Z' }),
      report({
        id: 4,
        event_id: 2,
        status: 'submitted',
        reported_at: '2026-11-01T10:00:00Z',
      }),
    ]

    expect(correctableReports(reports, 1).map((entry) => entry.id)).toEqual([3, 2])
  })

  it('leaves the input order untouched', () => {
    const reports = [
      report({ id: 1, reported_at: '2026-11-01T08:00:00Z' }),
      report({ id: 2, reported_at: '2026-11-01T09:00:00Z' }),
    ]

    correctableReports(reports, 1)

    expect(reports.map((entry) => entry.id)).toEqual([1, 2])
  })
})
