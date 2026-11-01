import {
  REALTIME_EVENT_NAMES,
  type RealtimeEventName,
  type RealtimeUpdate,
} from '../types/realtime'

const PAYLOAD_KEYS = new Set(['id', 'barangay_id', 'status', 'changed'])

const AUTH_REFRESH_SHARE = 0.8
const AUTH_REFRESH_MIN_MS = 5_000
const AUTH_REFRESH_FALLBACK_MS = 60_000

export function isRealtimeEventName(value: unknown): value is RealtimeEventName {
  return (
    typeof value === 'string' &&
    (REALTIME_EVENT_NAMES as readonly string[]).includes(value)
  )
}

/**
 * D-64 and NFR-30: the payload carries only id, barangay id, status, and the
 * changed field names. Anything else is a contract defect, so the update is
 * dropped and the polling substitute catches up.
 */
export function parseRealtimePayload(
  event: unknown,
  payload: unknown,
): RealtimeUpdate | null {
  if (!isRealtimeEventName(event)) {
    return null
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return null
  }

  const record = payload as Record<string, unknown>
  const keys = Object.keys(record)

  if (
    keys.length !== PAYLOAD_KEYS.size ||
    keys.some((key) => !PAYLOAD_KEYS.has(key))
  ) {
    return null
  }

  const { id, barangay_id: barangayId, status, changed } = record

  if (!isPositiveInteger(id) || !isPositiveInteger(barangayId)) {
    return null
  }

  if (typeof status !== 'string' || status === '') {
    return null
  }

  if (
    !Array.isArray(changed) ||
    changed.some((field) => typeof field !== 'string')
  ) {
    return null
  }

  if (event === 'report.created' && changed.length > 0) {
    return null
  }

  return {
    event,
    reportId: id,
    barangayId,
    status,
    changed: [...changed],
  }
}

/**
 * The validated feed is a function of status, so only a status transition can
 * change what the heatmap plots; a new submission is not validated yet.
 */
export function affectsValidatedFeed(update: RealtimeUpdate): boolean {
  return update.event === 'report.status_changed'
}

export function authRefreshDelayMs(
  expiresAt: string | null,
  now: number,
): number {
  if (expiresAt === null) {
    return AUTH_REFRESH_FALLBACK_MS
  }

  const expiry = Date.parse(expiresAt)

  if (Number.isNaN(expiry)) {
    return AUTH_REFRESH_FALLBACK_MS
  }

  const remaining = expiry - now

  if (remaining <= 0) {
    return AUTH_REFRESH_MIN_MS
  }

  return Math.max(AUTH_REFRESH_MIN_MS, Math.round(remaining * AUTH_REFRESH_SHARE))
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}
