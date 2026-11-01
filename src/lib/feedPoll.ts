import { FEED_POLL_INTERVAL_MS, FEED_POLL_JITTER_MS } from './feedFreshness'
import type { RealtimeFeedStatus } from './useRealtimeFeed'

export interface FeedPollOptions {
  intervalMs?: number
  jitterMs?: number
  random?: () => number
  poll?: boolean
  setTimer?: (callback: () => void, delayMs: number) => number
  clearTimer?: (handle: number) => void
}

export interface FeedPoller {
  stop(): void
}

export function nextPollDelay(
  intervalMs: number,
  jitterMs: number,
  random: () => number,
): number {
  return Math.round(intervalMs + (random() * 2 - 1) * jitterMs)
}

/**
 * Polling is realtime's substitute, not a second channel: it runs only while the
 * live transport cannot deliver updates. Being backgrounded is the other axis and
 * belongs to `useFeedPoll`, where the tab's visibility is known.
 */
export function feedPollEnabled(realtimeStatus: RealtimeFeedStatus): boolean {
  return realtimeStatus === 'disabled' || realtimeStatus === 'failed'
}

export function startFeedPoll(
  run: () => Promise<void>,
  options: FeedPollOptions = {},
): FeedPoller {
  const intervalMs = options.intervalMs ?? FEED_POLL_INTERVAL_MS
  const jitterMs = options.jitterMs ?? FEED_POLL_JITTER_MS
  const random = options.random ?? Math.random
  const polling = options.poll ?? true
  const setTimer =
    options.setTimer ??
    ((callback: () => void, delayMs: number) =>
      globalThis.setTimeout(callback, delayMs) as unknown as number)
  const clearTimer =
    options.clearTimer ??
    ((handle: number) => globalThis.clearTimeout(handle))

  let stopped = false
  let timer: number | null = null

  async function cycle(): Promise<void> {
    if (stopped) {
      return
    }

    try {
      await run()
    } catch {
      // The caller records the failure; the next cycle still runs.
    }

    if (stopped || !polling) {
      return
    }

    timer = setTimer(() => {
      timer = null
      void cycle()
    }, nextPollDelay(intervalMs, jitterMs, random))
  }

  void cycle()

  return {
    stop() {
      stopped = true

      if (timer !== null) {
        clearTimer(timer)
        timer = null
      }
    },
  }
}
