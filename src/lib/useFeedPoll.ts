import { useCallback, useEffect, useState } from 'react'
import { startFeedPoll } from './feedPoll'
import { usePageVisible } from './pageVisibility'

export interface FeedPollState {
  lastSuccessAt: number | null
  refresh: () => void
}

export function useFeedPoll(
  load: (signal: AbortSignal) => Promise<void>,
  {
    intervalMs,
    jitterMs,
    enabled = true,
    pauseWhenHidden = true,
  }: {
    intervalMs?: number
    jitterMs?: number
    enabled?: boolean
    pauseWhenHidden?: boolean
  } = {},
): FeedPollState {
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null)
  const [generation, setGeneration] = useState(0)
  const visible = usePageVisible()
  const paused = pauseWhenHidden && !visible

  useEffect(() => {
    if (paused) {
      // Backgrounded tabs get no cycle at all: hiding must not fire one last
      // fetch, and showing again runs the cycle straight away.
      return
    }

    const controller = new AbortController()
    const poller = startFeedPoll(async () => {
      await load(controller.signal)
      setLastSuccessAt(Date.now())
    }, { intervalMs, jitterMs, poll: enabled })

    return () => {
      controller.abort()
      poller.stop()
    }
  }, [load, generation, intervalMs, jitterMs, enabled, paused])

  const refresh = useCallback(() => {
    setGeneration((value) => value + 1)
  }, [])

  return { lastSuccessAt, refresh }
}
