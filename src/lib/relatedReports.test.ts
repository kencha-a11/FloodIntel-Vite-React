import { describe, expect, it } from 'vitest'
import type { FloodReport } from '../types/report'
import {
  relatedReportCandidates,
  relatedReportIdsLabel,
  toggleRelatedReport,
} from './relatedReports'

function report(
  id: number,
  reportedAt: string | null,
  createdAt = '2026-11-01T00:00:00Z',
): FloodReport {
  return {
    id,
    user: { id: 1, first_name: 'Test', last_name: 'Captain', role: 'barangay_captain' },
    barangay: { id: 1, name: 'Barangay Test' },
    flood_level: 'knee',
    flood_level_label: 'Knee-deep',
    severity: 2,
    alert_level: 'alert',
    alert_level_label: 'Level 1 — Alert',
    alert_severity: 1,
    flood_type: 'ponding',
    flood_type_label: 'Ponding',
    depth_cm: 40,
    landmark: null,
    latitude: 14.95,
    longitude: 120.8,
    gps_accuracy: 5,
    address: null,
    photo_url: '/storage/flood.jpg',
    notes: null,
    reported_at: reportedAt,
    status: 'submitted',
    status_label: 'Submitted',
    anomaly_flags: [],
    rejection_reason: null,
    rejected_at: null,
    supersedes_id: null,
    created_at: createdAt,
  }
}

describe('relatedReportCandidates', () => {
  it('orders the newest observation first', () => {
    const ids = relatedReportCandidates([
      report(1, '2026-10-31T08:00:00Z'),
      report(2, '2026-11-01T09:00:00Z'),
      report(3, '2026-10-30T08:00:00Z'),
    ]).map((item) => item.id)

    expect(ids).toEqual([2, 1, 3])
  })

  it('falls back to the save time when no observation time exists', () => {
    const ids = relatedReportCandidates([
      report(1, null, '2026-10-30T08:00:00Z'),
      report(2, '2026-10-31T08:00:00Z'),
    ]).map((item) => item.id)

    expect(ids).toEqual([2, 1])
  })

  it('caps the list without mutating the input', () => {
    const input = [report(1, '2026-11-01T08:00:00Z'), report(2, '2026-11-01T09:00:00Z')]

    expect(relatedReportCandidates(input, 1).map((item) => item.id)).toEqual([2])
    expect(input.map((item) => item.id)).toEqual([1, 2])
  })
})

describe('toggleRelatedReport', () => {
  it('adds an id once and removes it on the next toggle', () => {
    const selected = toggleRelatedReport([], 7)

    expect(selected).toEqual([7])
    expect(toggleRelatedReport(selected, 7)).toEqual([])
  })

  it('keeps the order the captain picked', () => {
    expect(toggleRelatedReport(toggleRelatedReport([], 3), 9)).toEqual([3, 9])
  })
})

describe('relatedReportIdsLabel', () => {
  it('names an empty or missing selection as none', () => {
    expect(relatedReportIdsLabel(null)).toBe('None')
    expect(relatedReportIdsLabel(undefined)).toBe('None')
    expect(relatedReportIdsLabel([])).toBe('None')
  })

  it('lists the chosen ids', () => {
    expect(relatedReportIdsLabel([12, 15])).toBe('#12, #15')
  })
})
