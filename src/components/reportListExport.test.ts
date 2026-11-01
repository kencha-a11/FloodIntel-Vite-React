import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

/*
 * FR-29: the review queue's search and the export must be the same query.
 * These guards pin the wiring the pure helpers cannot prove on their own.
 */

describe('report queue export wiring', () => {
  it('adds the free-text field beside the queue filters', () => {
    const list = read('./ReportList.tsx')

    expect(list).toContain('id="filter-q"')
    expect(list).toContain("updateFilter('q'")
    expect(list).toContain('Matches notes, landmark, address, or reporter name.')
  })

  it('filters by flood type from the shared list and names it in the row', () => {
    const list = read('./ReportList.tsx')

    expect(list).toContain('id="filter-type"')
    expect(list).toContain("updateFilter('flood_type'")
    expect(list).toContain('FLOOD_TYPES.map(')
    expect(list).toContain("flood_type: '',")
    expect(list).toContain('floodTypeLabel(report.flood_type)')
  })

  it('exports through the shared filters with the applied dates', () => {
    const list = read('./ReportList.tsx')

    expect(list).toContain('exportReportCsv(token, {')
    expect(list).toContain('from: startOfDay(filters.from)')
    expect(list).toContain('to: endOfDay(filters.to)')
    expect(list).toContain('reportExportFilename(filters)')
    expect(list).toContain('downloadBlob(result.blob')
    expect(list).toContain('exportNoticeText(filters, result.count)')
  })

  it('shows the control to the command center only and disables it in flight', () => {
    const list = read('./ReportList.tsx')

    expect(list).toContain('{canFilter && (')
    expect(list).toContain('disabled={exporting}')
    expect(list).toContain('aria-busy={exporting}')
    expect(list).toContain("exporting ? 'Preparing CSV…' : 'Export CSV'")
    expect(list).toContain('role="status"')
  })

  it('reports a failed export without discarding the queue', () => {
    const list = read('./ReportList.tsx')

    expect(list).toContain('setExportError(')
    expect(list).toContain("err instanceof AuthApiError && err.status === 401")
    expect(list).toContain('{exportError && <Alert tone="danger">{exportError}</Alert>}')
  })

  it('places the export control after the filters and before the list', () => {
    const list = read('./ReportList.tsx')

    expect(list.indexOf('<div className="report-export">')).toBeGreaterThan(
      list.indexOf('<div className="filter-bar">'),
    )
    expect(list.indexOf('<div className="report-export">')).toBeLessThan(
      list.indexOf('{isLoading ? ('),
    )
  })
})
