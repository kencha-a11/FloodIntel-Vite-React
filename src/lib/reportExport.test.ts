import { describe, expect, it } from 'vitest'
import type { ReportFilters } from '../types/report'
import { buildReportQuery } from './reportApi'
import {
  exportNoticeText,
  parseExportCount,
  reportExportFilename,
  reportExportSummary,
} from './reportExport'

const EMPTY: ReportFilters = {
  q: '',
  flood_level: '',
  flood_type: '',
  alert_level: '',
  status: '',
  barangay_id: '',
  from: '',
  to: '',
  per_page: 15,
  page: 1,
}

describe('report export', () => {
  it('names the applied filters in the filename', () => {
    expect(reportExportFilename(EMPTY)).toBe(
      'flood-reports-all-statuses-all-types-all-alerts.csv',
    )

    expect(
      reportExportFilename({
        ...EMPTY,
        status: 'validated',
        flood_type: 'ponding',
        alert_level: 'red_alert',
        from: '2026-10-01',
        to: '2026-11-01',
      }),
    ).toBe(
      'flood-reports-validated-ponding-red_alert-from-2026-10-01-to-2026-11-01.csv',
    )
  })

  it('slugs a free-text term and truncates it to a safe filename', () => {
    expect(
      reportExportFilename({ ...EMPTY, q: 'Bridge / Riverside!' }),
    ).toBe('flood-reports-all-statuses-all-types-all-alerts-search-bridge-riverside.csv')

    expect(
      reportExportFilename({ ...EMPTY, q: 'a'.repeat(40) }),
    ).toBe(
      `flood-reports-all-statuses-all-types-all-alerts-search-${'a'.repeat(24)}.csv`,
    )
  })

  it('reads the row count header and refuses anything else', () => {
    expect(parseExportCount('12')).toBe(12)
    expect(parseExportCount('0')).toBe(0)
    expect(parseExportCount(null)).toBeNull()
    expect(parseExportCount('12,000')).toBeNull()
    expect(parseExportCount('')).toBeNull()
  })

  it('states the applied scope in words a reviewer can check', () => {
    expect(reportExportSummary(EMPTY)).toBe(
      'All statuses · All flood types · All alert levels · All dates',
    )

    expect(
      reportExportSummary({
        ...EMPTY,
        status: 'returned',
        flood_type: 'river_overflow',
        alert_level: 'get_ready',
        from: '2026-10-01',
      }),
    ).toBe('Returned · River overflow · Level 2 — Get Ready · 2026-10-01 to …')

    expect(reportExportSummary({ ...EMPTY, q: 'bridge' })).toBe(
      'All statuses · All flood types · All alert levels · All dates · Search "bridge" in notes, landmark, address, or reporter name',
    )
  })

  it('announces the downloaded count, singular or repeated', () => {
    expect(exportNoticeText(EMPTY, 1)).toBe(
      'Exported 1 report — All statuses · All flood types · All alert levels · All dates.',
    )
    expect(exportNoticeText(EMPTY, 3)).toContain('Exported 3 reports')
    expect(exportNoticeText(EMPTY, null)).toContain('Export downloaded')
  })

  it('encodes the same filters the queue sends, without paging', () => {
    const query = new URLSearchParams(
      buildReportQuery(
        { ...EMPTY, q: 'knee deep', status: 'validated', flood_type: 'ponding' },
        { pagination: false },
      ),
    )

    expect(query.get('q')).toBe('knee deep')
    expect(query.get('status')).toBe('validated')
    expect(query.get('flood_type')).toBe('ponding')
    expect(query.get('page')).toBeNull()
    expect(query.get('per_page')).toBeNull()

    const queueQuery = new URLSearchParams(buildReportQuery(EMPTY))

    expect(queueQuery.get('page')).toBe('1')
    expect(queueQuery.get('per_page')).toBe('15')
  })
})
