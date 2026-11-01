import type { ReportFilters } from '../types/report'
import { API_BASE_URL, AuthApiError, NetworkTimeoutError } from './http'
import { buildReportQuery } from './reportApi'
import { alertTierLabel, reportStatusLabel } from './vocabulary'

const EXPORT_TIMEOUT_MS = 120_000
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export interface ReportExport {
  blob: Blob
  count: number | null
}

/**
 * Fetch the filtered log as CSV. The row count comes back in a header so the
 * screen can state what was downloaded without reading the file back.
 */
export async function exportReportCsv(
  token: string,
  filters: ReportFilters,
): Promise<ReportExport> {
  const suffix = buildReportQuery(filters, { pagination: false })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EXPORT_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${API_BASE_URL}/flood-reports/export${suffix === '' ? '' : `?${suffix}`}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      },
    )

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string
      } | null

      throw new AuthApiError(
        body?.message ?? 'Unable to export the report log.',
        response.status,
      )
    }

    return {
      blob: await response.blob(),
      count: parseExportCount(response.headers.get('X-Report-Count')),
    }
  } catch (err) {
    if (controller.signal.aborted) {
      throw new NetworkTimeoutError('The export timed out.')
    }

    throw err
  } finally {
    clearTimeout(timer)
  }
}

export function parseExportCount(header: string | null): number | null {
  if (header === null || !/^\d+$/.test(header)) {
    return null
  }

  return Number.parseInt(header, 10)
}

export function reportExportFilename(filters: ReportFilters): string {
  const parts = [
    'flood-reports',
    filters.status === '' ? 'all-statuses' : filters.status,
    filters.alert_level === '' ? 'all-alerts' : filters.alert_level,
  ]

  if (filters.from !== '') {
    parts.push(`from-${dateOnly(filters.from)}`)
  }

  if (filters.to !== '') {
    parts.push(`to-${dateOnly(filters.to)}`)
  }

  if (filters.q !== '') {
    const term = slug(filters.q)

    if (term !== '') {
      parts.push(`search-${term}`)
    }
  }

  return `${parts.join('-')}.csv`
}

export function reportExportSummary(filters: ReportFilters): string {
  const parts = [
    filters.status === '' ? 'All statuses' : reportStatusLabel(filters.status),
    filters.alert_level === '' ? 'All alert levels' : alertTierLabel(filters.alert_level),
  ]

  if (filters.from === '' && filters.to === '') {
    parts.push('All dates')
  } else {
    parts.push(
      `${filters.from === '' ? '…' : dateOnly(filters.from)} to ${filters.to === '' ? '…' : dateOnly(filters.to)}`,
    )
  }

  if (filters.q !== '') {
    parts.push(`Search "${filters.q}" in notes, landmark, address, or reporter name`)
  }

  return parts.join(' · ')
}

export function exportNoticeText(
  filters: ReportFilters,
  count: number | null,
): string {
  const scope = reportExportSummary(filters)

  if (count === null) {
    return `Export downloaded — ${scope}.`
  }

  return `Exported ${count} ${count === 1 ? 'report' : 'reports'} — ${scope}.`
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Revoking in the click handler cancels the transfer before Chrome starts it.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function dateOnly(value: string): string {
  return DATE_ONLY.test(value) ? value : value.slice(0, 10)
}

function slug(value: string, maxLength = 24): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '')
}
