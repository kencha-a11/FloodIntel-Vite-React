import { API_BASE_URL, request } from './http'

const CACHE_KEY = 'floodintel:deadlines'

export interface DeadlineBarangay {
  barangay_id: number
  barangay: string
  pending: number
}

export interface DeadlinesPayload {
  timezone: string
  cutoffs: string[]
  now: string
  window: {
    starts_at: string
    next_cutoff_at: string
    label: string
  }
  pending: {
    basis: 'reported_at' | 'reported_at_with_created_at_fallback'
    total: number
    by_barangay: DeadlineBarangay[]
  }
}

export interface CachedDeadlines {
  payload: DeadlinesPayload
  fetchedAt: number
}

export function fetchDeadlines(token: string): Promise<DeadlinesPayload> {
  return request<{ data: DeadlinesPayload }>(
    `${API_BASE_URL}/flood-reports/deadlines`,
    { headers: { Authorization: `Bearer ${token}` } },
  ).then((response) => response.data)
}

/**
 * The countdown runs from the server's own instants (D-24): the device clock
 * only contributes the elapsed time since the payload arrived.
 */
export function remainingSeconds(
  nextCutoffAt: string,
  serverNow: string,
  elapsedSeconds: number,
): number {
  const remaining =
    (Date.parse(nextCutoffAt) - Date.parse(serverNow)) / 1000 - elapsedSeconds

  return Math.max(0, Math.floor(remaining))
}

export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secondsPart = seconds % 60
  const pad = (value: number): string => String(value).padStart(2, '0')

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secondsPart)}`
    : `${minutes}:${pad(secondsPart)}`
}

export function describeBasis(
  basis: DeadlinesPayload['pending']['basis'],
): string {
  return basis === 'reported_at'
    ? 'Counted from each report’s observation time.'
    : 'Some reports have no observation time; receipt time stands in for those.'
}

export function describeAsOf(fetchedAt: number): string {
  return new Date(fetchedAt).toLocaleTimeString()
}

export function readCachedDeadlines(): CachedDeadlines | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null
    }

    const raw = localStorage.getItem(CACHE_KEY)

    if (raw === null) {
      return null
    }

    const parsed = JSON.parse(raw) as CachedDeadlines

    if (
      typeof parsed.fetchedAt !== 'number' ||
      typeof parsed.payload?.window?.next_cutoff_at !== 'string'
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function cacheDeadlines(payload: DeadlinesPayload, fetchedAt: number): void {
  try {
    if (typeof localStorage === 'undefined') {
      return
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify({ payload, fetchedAt }))
  } catch {
    // A full or disabled store only costs the last-known panel.
  }
}
