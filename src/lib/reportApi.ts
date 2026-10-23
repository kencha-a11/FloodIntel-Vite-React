import type {
  Barangay,
  FloodReport,
  FloodReportInput,
  Paginated,
  ReportFilters,
} from '../types/report'
import { API_BASE_URL, request, requestForm } from './http'

export function listReports(
  token: string,
  filters: ReportFilters,
): Promise<Paginated<FloodReport>> {
  const suffix = buildQuery(filters)

  return request<Paginated<FloodReport>>(
    `${API_BASE_URL}/flood-reports${suffix === '' ? '' : `?${suffix}`}`,
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
  form.append('flood_level', report.flood_level)
  form.append('latitude', String(report.latitude))
  form.append('longitude', String(report.longitude))

  if (report.gps_accuracy !== null) {
    form.append('gps_accuracy', String(report.gps_accuracy))
  }

  if (report.notes !== null && report.notes !== '') {
    form.append('notes', report.notes)
  }

  if (report.reported_at !== null) {
    form.append('reported_at', report.reported_at)
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

export function listBarangays(token: string): Promise<Barangay[]> {
  return request<{ data: Barangay[] }>(`${API_BASE_URL}/barangays`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => response.data)
}

function buildQuery(filters: ReportFilters): string {
  const query = new URLSearchParams()

  if (filters.flood_level !== '') {
    query.set('flood_level', filters.flood_level)
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

  query.set('per_page', String(filters.per_page))
  query.set('page', String(filters.page))

  return query.toString()
}
