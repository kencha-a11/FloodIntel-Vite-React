export type RealtimeEventName = 'report.created' | 'report.status_changed'

export const REALTIME_EVENT_NAMES: readonly RealtimeEventName[] = [
  'report.created',
  'report.status_changed',
]

export interface RealtimeUpdate {
  event: RealtimeEventName
  reportId: number
  barangayId: number
  status: string
  changed: string[]
}

export interface RealtimeAuthorization {
  enabled: boolean
  url: string | null
  anonKey: string | null
  token: string | null
  expiresAt: string | null
  topics: string[]
}

export interface RealtimeLatencySummary {
  windowHours: number
  samples: number
  excluded: number
  medianMs: number | null
  maxMs: number | null
  boundMs: number
  breaches: number
}
