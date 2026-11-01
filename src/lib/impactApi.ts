import type { FloodImpactReport, ImpactEvent } from '../types/impact'
import { API_BASE_URL, request } from './http'

const EVENTS_CACHE_KEY = 'floodintel:impact-events'

export function readCachedEvents(): ImpactEvent[] {
  try {
    const raw = window.localStorage.getItem(EVENTS_CACHE_KEY)

    return raw === null ? [] : (JSON.parse(raw) as ImpactEvent[])
  } catch {
    return []
  }
}

export function cacheEvents(events: ImpactEvent[]): void {
  try {
    window.localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(events))
  } catch {
    // A full or disabled store only costs the offline event list.
  }
}

export function listOpenEvents(token: string): Promise<ImpactEvent[]> {
  return request<{ data: ImpactEvent[] }>(`${API_BASE_URL}/flood-events`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    cacheEvents(response.data)

    return response.data
  })
}

export function listImpactReports(
  token: string,
  options: { perPage?: number } = {},
): Promise<FloodImpactReport[]> {
  const query = new URLSearchParams({
    per_page: String(options.perPage ?? 50),
  })

  return request<{ data: FloodImpactReport[] }>(
    `${API_BASE_URL}/flood-impact-reports?${query.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  ).then((response) => response.data)
}

function newestFirst(
  left: FloodImpactReport,
  right: FloodImpactReport,
): number {
  return (
    Date.parse(right.reported_at ?? right.created_at) -
    Date.parse(left.reported_at ?? left.created_at)
  )
}

export function previousReportFor(
  reports: FloodImpactReport[],
  eventId: number | null,
): FloodImpactReport | null {
  if (eventId === null) {
    return null
  }

  return (
    reports
      .filter((report) => report.event_id === eventId)
      .sort(newestFirst)[0] ?? null
  )
}

export function previousFamiliesFor(
  reports: FloodImpactReport[],
  eventId: number | null,
): number | null {
  return previousReportFor(reports, eventId)?.families ?? null
}

export function correctableReports(
  reports: FloodImpactReport[],
  eventId: number | null,
): FloodImpactReport[] {
  if (eventId === null) {
    return []
  }

  return reports
    .filter(
      (report) =>
        report.event_id === eventId && report.status === 'submitted',
    )
    .sort(newestFirst)
}
