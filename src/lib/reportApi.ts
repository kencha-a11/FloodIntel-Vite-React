import type {
  Barangay,
  FloodReport,
  FloodReportInput,
  FloodReportStatus,
  Paginated,
  ReportFilters,
  ValidatedFeedPage,
} from '../types/report'
import type { ImpactReportInput, FloodImpactReport } from '../types/impact'
import { API_BASE_URL, request, requestForm } from './http'

export function listReports(
  token: string,
  filters: ReportFilters,
): Promise<Paginated<FloodReport>> {
  const suffix = buildReportQuery(filters)

  return request<Paginated<FloodReport>>(
    `${API_BASE_URL}/flood-reports${suffix === '' ? '' : `?${suffix}`}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
}

export function listValidatedFeed(
  token: string,
  options: { limit?: number } = {},
): Promise<ValidatedFeedPage> {
  const query = new URLSearchParams()

  if (options.limit !== undefined) {
    query.set('limit', String(options.limit))
  }

  const suffix = query.toString()

  return request<ValidatedFeedPage>(
    `${API_BASE_URL}/flood-reports/validated-feed${suffix === '' ? '' : `?${suffix}`}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
}

export function getReport(
  token: string,
  reportId: number,
): Promise<FloodReport> {
  return request<{ data: FloodReport }>(
    `${API_BASE_URL}/flood-reports/${reportId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  ).then((response) => response.data)
}

export function submitReport(
  token: string,
  report: FloodReportInput,
  photo: Blob,
  clientUuid: string,
  photoName = 'flood-report.jpg',
): Promise<FloodReport> {
  const form = new FormData()

  form.append('client_uuid', clientUuid)
  form.append('latitude', String(report.latitude))
  form.append('longitude', String(report.longitude))

  if (report.supersedes_id !== undefined && report.supersedes_id !== null) {
    form.append('supersedes_id', String(report.supersedes_id))
  }

  if (report.gps_accuracy !== null) {
    form.append('gps_accuracy', String(report.gps_accuracy))
  }

  if (report.notes !== null && report.notes !== '') {
    form.append('notes', report.notes)
  }

  if (report.reported_at !== null) {
    form.append('reported_at', report.reported_at)
  }

  // Append exactly one level vocabulary.
  if ('alert_level' in report && report.alert_level !== undefined) {
    form.append('alert_level', report.alert_level)
    if ('flood_type' in report && report.flood_type !== undefined) {
      form.append('flood_type', report.flood_type)
    }
    if ('depth_cm' in report && report.depth_cm !== null) {
      form.append('depth_cm', String(report.depth_cm))
    }
    if ('landmark' in report && report.landmark !== null) {
      form.append('landmark', report.landmark)
    }
  } else {
    form.append('flood_level', report.flood_level)
  }

  form.append('photo', photo, photoName)

  return requestForm<{ data: FloodReport }>(
    `${API_BASE_URL}/flood-reports`,
    form,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  ).then((response) => response.data)
}

export function submitImpactReport(
  token: string,
  report: ImpactReportInput,
): Promise<FloodImpactReport> {
  const body: Record<string, unknown> = {
    event_id: report.event_id,
    families: report.families,
    individuals: report.individuals,
    remarks: report.remarks,
  }
  if (report.breakdown) body.breakdown = report.breakdown
  if (report.related_level_report_ids) body.related_level_report_ids = report.related_level_report_ids
  if (report.reported_at) body.reported_at = report.reported_at
  if (report.supersedes_id) body.supersedes_id = report.supersedes_id

  return request<{ data: FloodImpactReport }>(
    `${API_BASE_URL}/flood-impact-reports`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
  ).then((response) => response.data)
}
export function rejectReport(
  token: string,
  reportId: number,
  rejectionReason: string,
): Promise<FloodReport> {
  return request<{ data: FloodReport }>(
    `${API_BASE_URL}/flood-reports/${reportId}/reject`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rejection_reason: rejectionReason }),
    },
  ).then((response) => response.data)
}

export function validateReport(
  token: string,
  reportId: number,
): Promise<FloodReport> {
  return decisionRequest(token, reportId, 'validate')
}

export function returnReport(
  token: string,
  reportId: number,
  returnReason: string,
): Promise<FloodReport> {
  return decisionRequest(token, reportId, 'return', {
    return_reason: returnReason,
  })
}

export function overrideReport(
  token: string,
  reportId: number,
  toStatus: FloodReportStatus,
  reason: string,
): Promise<FloodReport> {
  return decisionRequest(token, reportId, 'override', {
    to_status: toStatus,
    reason,
  })
}

function decisionRequest(
  token: string,
  reportId: number,
  action: 'validate' | 'return' | 'override',
  body?: Record<string, string>,
): Promise<FloodReport> {
  return request<{ data: FloodReport }>(
    `${API_BASE_URL}/flood-reports/${reportId}/${action}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  ).then((response) => response.data)
}

export function listBarangays(token: string): Promise<Barangay[]> {  return request<{ data: Barangay[] }>(`${API_BASE_URL}/barangays`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => response.data)
}

/**
 * The queue and the export share one filter encoding, so a control that
 * narrows the list narrows the CSV the same way (FR-29).
 */
export function buildReportQuery(
  filters: ReportFilters,
  options: { pagination?: boolean } = {},
): string {
  const query = new URLSearchParams()

  if (filters.q !== '') {
    query.set('q', filters.q)
  }

  if (filters.flood_level !== '') {
    query.set('flood_level', filters.flood_level)
  }

  if (filters.alert_level !== '') {
    query.set('alert_level', filters.alert_level)
  }

  if (filters.status !== '') {
    query.set('status', filters.status)
  }

  if (filters.barangay_id !== '') {
    query.set('barangay_id', String(filters.barangay_id))
  }

  if (filters.from !== '') {
    query.set('from', filters.from)
  }

  if (filters.to !== '') {
    query.set('to', filters.to)
  }

  if (options.pagination !== false) {
    query.set('per_page', String(filters.per_page))
    query.set('page', String(filters.page))
  }

  return query.toString()
}
