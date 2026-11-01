import { describe, expect, it } from 'vitest'
import type { AlertLevel, ValidatedFeedRow } from '../types/report'
import {
  DEFAULT_MAP_REPORT_SORT,
  MAP_REPORT_SORT_OPTIONS,
  mapReportSortLabel,
  newestReceivedAt,
  sortMapRows,
} from './mapReportList'

function row(
  id: number,
  alertLevel: AlertLevel,
  observed: string,
  received: string,
  barangay = 'San Juan (Pob.)',
): ValidatedFeedRow {
  return {
    id,
    latitude: 14.95,
    longitude: 120.8,
    gps_accuracy: 5,
    barangay: { id, name: barangay },
    alert_level: alertLevel,
    alert_level_label: '',
    alert_severity: 1,
    depth_cm: 30,
    observed_at: observed,
    received_at: received,
    status: 'validated',
    status_label: '',
    source: 'reported',
    source_label: '',
  }
}

describe('sortMapRows', () => {
  it('orders by alert tier, then by newest observed, then by id', () => {
    const rows = [
      row(1, 'alert', '2026-11-01T08:00:00Z', '2026-11-01T08:05:00Z'),
      row(2, 'red_alert', '2026-11-01T07:00:00Z', '2026-11-01T07:05:00Z'),
      row(3, 'get_ready', '2026-11-01T09:00:00Z', '2026-11-01T09:05:00Z'),
      row(4, 'red_alert', '2026-11-01T10:00:00Z', '2026-11-01T10:05:00Z'),
    ]

    expect(sortMapRows(rows, 'tier').map((entry) => entry.id)).toEqual([4, 2, 3, 1])
  })

  it('breaks a tier tie by id when the observed instants match', () => {
    const rows = [
      row(7, 'get_ready', '2026-11-01T09:00:00Z', '2026-11-01T09:05:00Z'),
      row(9, 'get_ready', '2026-11-01T09:00:00Z', '2026-11-01T09:05:00Z'),
    ]

    expect(sortMapRows(rows, 'tier').map((entry) => entry.id)).toEqual([9, 7])
  })

  it('orders by the observed instant, newest first', () => {
    const rows = [
      row(1, 'alert', '2026-11-01T08:00:00Z', '2026-11-01T12:00:00Z'),
      row(2, 'red_alert', '2026-11-01T10:00:00Z', '2026-11-01T10:05:00Z'),
      row(3, 'get_ready', '2026-11-01T09:00:00Z', '2026-11-01T11:00:00Z'),
    ]

    expect(sortMapRows(rows, 'observed').map((entry) => entry.id)).toEqual([2, 3, 1])
  })

  it('orders by the received instant, newest first, without merging it into observed', () => {
    const rows = [
      row(1, 'get_ready', '2026-11-01T12:00:00Z', '2026-11-01T08:00:00Z'),
      row(2, 'red_alert', '2026-11-01T08:00:00Z', '2026-11-01T12:00:00Z'),
      row(3, 'alert', '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z'),
    ]

    expect(sortMapRows(rows, 'received').map((entry) => entry.id)).toEqual([2, 3, 1])
  })

  it('orders barangay names A–Z and falls back to the tier within one name', () => {
    const rows = [
      row(1, 'alert', '2026-11-01T08:00:00Z', '2026-11-01T08:00:00Z', 'Sucad'),
      row(2, 'get_ready', '2026-11-01T08:00:00Z', '2026-11-01T08:00:00Z', 'Balucuc'),
      row(3, 'red_alert', '2026-11-01T08:00:00Z', '2026-11-01T08:00:00Z', 'Sucad'),
      row(4, 'get_ready', '2026-11-01T08:00:00Z', '2026-11-01T08:00:00Z', 'Sucad'),
    ]

    expect(sortMapRows(rows, 'barangay').map((entry) => entry.id)).toEqual([2, 3, 4, 1])
  })

  it('returns a new array and leaves the loaded rows untouched', () => {
    const rows = [
      row(1, 'alert', '2026-11-01T08:00:00Z', '2026-11-01T08:00:00Z'),
      row(2, 'red_alert', '2026-11-01T09:00:00Z', '2026-11-01T09:00:00Z'),
    ]
    const order = rows.map((entry) => entry.id)

    const sorted = sortMapRows(rows, 'tier')

    expect(sorted).not.toBe(rows)
    expect(rows.map((entry) => entry.id)).toEqual(order)
    expect(sorted.map((entry) => entry.id)).toEqual([2, 1])
  })
})

describe('newestReceivedAt', () => {
  it('names the latest received instant rather than the latest observed one', () => {
    const rows = [
      row(1, 'alert', '2026-11-01T12:00:00Z', '2026-11-01T08:00:00Z'),
      row(2, 'get_ready', '2026-11-01T08:00:00Z', '2026-11-01T12:00:00Z'),
    ]

    expect(newestReceivedAt(rows)).toBe('2026-11-01T12:00:00Z')
  })

  it('returns null for an empty list', () => {
    expect(newestReceivedAt([])).toBeNull()
  })
})

describe('map report sort options', () => {
  it('offers the default sort and a label for every option', () => {
    expect(MAP_REPORT_SORT_OPTIONS.map((option) => option.value)).toContain(
      DEFAULT_MAP_REPORT_SORT,
    )

    for (const option of MAP_REPORT_SORT_OPTIONS) {
      expect(mapReportSortLabel(option.value)).toBe(option.label)
    }
  })
})
