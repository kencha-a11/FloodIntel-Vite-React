import { formatDuration } from './format'

export const FEED_POLL_INTERVAL_MS = 30_000
export const FEED_POLL_JITTER_MS = 6_000
export const FEED_STALE_AFTER_MS = FEED_POLL_INTERVAL_MS + FEED_POLL_JITTER_MS

export type FeedFreshnessState = 'pending' | 'fresh' | 'stale' | 'live'

export interface FeedFreshness {
  state: FeedFreshnessState
  ageSeconds: number | null
  label: string
  note: string
}

export interface FreshnessOptions {
  staleAfterMs?: number
  live?: boolean
}

function intervalSeconds(): number {
  return Math.round(FEED_POLL_INTERVAL_MS / 1000)
}

export function describeFreshness(
  lastSuccessAt: number | null,
  now: number,
  options: FreshnessOptions = {},
): FeedFreshness {
  const staleAfterMs = options.staleAfterMs ?? FEED_STALE_AFTER_MS

  if (lastSuccessAt === null) {
    if (options.live) {
      return {
        state: 'live',
        ageSeconds: null,
        label: 'Waiting for the first update',
        note: `Live — connected to realtime; no update has arrived yet. If the connection drops, the list falls back to polling every ${intervalSeconds()}s.`,
      }
    }

    return {
      state: 'pending',
      ageSeconds: null,
      label: 'Waiting for the first update',
      note: `Substitute data — not live. The list refreshes every ${intervalSeconds()}s; refresh now if nothing arrives.`,
    }
  }

  const ageMs = Math.max(0, now - lastSuccessAt)
  const ageSeconds = Math.floor(ageMs / 1000)
  const label =
    ageSeconds === 0
      ? 'Updated just now'
      : `Updated ${formatDuration(ageSeconds)} ago`

  if (options.live) {
    return {
      state: 'live',
      ageSeconds,
      label,
      note: `Live — updates arrive without a refresh. If the connection drops, the list falls back to polling every ${intervalSeconds()}s.`,
    }
  }

  if (ageMs > staleAfterMs) {
    return {
      state: 'stale',
      ageSeconds,
      label: `${label} — stale`,
      note: `Not live, and no update has arrived since. It retries every ${intervalSeconds()}s; refresh now or check your connection.`,
    }
  }

  return {
    state: 'fresh',
    ageSeconds,
    label,
    note: `Substitute data — not live. Refreshes every ${intervalSeconds()}s.`,
  }
}
