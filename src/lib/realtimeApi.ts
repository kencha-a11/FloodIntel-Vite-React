import { API_BASE_URL, request } from './http'
import type {
  RealtimeAuthorization,
  RealtimeLatencySummary,
} from '../types/realtime'

interface AuthorizationResponse {
  data: {
    enabled: boolean
    url?: string
    anon_key?: string
    token?: string
    expires_at?: string
    topics?: string[]
  }
}

interface LatencySummaryResponse {
  data: {
    window_hours: number
    samples: number
    excluded: number
    median_ms: number | null
    max_ms: number | null
    bound_ms: number
    breaches: number
  }
}

export function fetchRealtimeAuthorization(
  token: string,
): Promise<RealtimeAuthorization> {
  return request<AuthorizationResponse>(
    `${API_BASE_URL}/realtime/authorization`,
    { headers: { Authorization: `Bearer ${token}` } },
  ).then((response) => ({
    enabled: response.data.enabled === true,
    url: response.data.url ?? null,
    anonKey: response.data.anon_key ?? null,
    token: response.data.token ?? null,
    expiresAt: response.data.expires_at ?? null,
    topics: response.data.topics ?? [],
  }))
}

export function reportRealtimeLatency(
  token: string,
  sample: {
    reportId: number
    event: string
    appliedAt: string
  },
): Promise<void> {
  return request<void>(`${API_BASE_URL}/realtime/latency`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      report_id: sample.reportId,
      event: sample.event,
      applied_at: sample.appliedAt,
    }),
  })
}

export function fetchLatencySummary(
  token: string,
  hours = 24,
): Promise<RealtimeLatencySummary> {
  return request<LatencySummaryResponse>(
    `${API_BASE_URL}/realtime/latency?hours=${hours}`,
    { headers: { Authorization: `Bearer ${token}` } },
  ).then((response) => ({
    windowHours: response.data.window_hours,
    samples: response.data.samples,
    excluded: response.data.excluded,
    medianMs: response.data.median_ms,
    maxMs: response.data.max_ms,
    boundMs: response.data.bound_ms,
    breaches: response.data.breaches,
  }))
}
