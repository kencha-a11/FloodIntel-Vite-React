import { afterEach, describe, expect, it, vi } from 'vitest'
import { feedPollEnabled, nextPollDelay, startFeedPoll } from './feedPoll'

describe('feedPollEnabled', () => {
  it('polls only while the live transport cannot deliver updates', () => {
    expect(feedPollEnabled('disabled')).toBe(true)
    expect(feedPollEnabled('failed')).toBe(true)
    expect(feedPollEnabled('live')).toBe(false)
    expect(feedPollEnabled('connecting')).toBe(false)
  })
})

describe('nextPollDelay', () => {
  it('stays inside the jitter bound', () => {
    expect(nextPollDelay(30_000, 6_000, () => 0)).toBe(24_000)
    expect(nextPollDelay(30_000, 6_000, () => 0.5)).toBe(30_000)
    expect(nextPollDelay(30_000, 6_000, () => 1)).toBe(36_000)
  })
})

describe('startFeedPoll', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs at once, waits a jittered interval, and never overlaps', async () => {
    vi.useFakeTimers()

    const releases: Array<() => void> = []
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releases.push(resolve)
        }),
    )
    const poller = startFeedPoll(run, {
      intervalMs: 1_000,
      jitterMs: 100,
      random: () => 0.5,
    })

    expect(run).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(run).toHaveBeenCalledTimes(1)

    releases.pop()?.()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(run).toHaveBeenCalledTimes(2)

    poller.stop()
    releases.pop()?.()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('stops without scheduling another cycle', async () => {
    vi.useFakeTimers()

    const run = vi.fn(async () => {})
    const poller = startFeedPoll(run, {
      intervalMs: 1_000,
      jitterMs: 0,
      random: () => 0.5,
    })

    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(1)

    poller.stop()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('keeps polling after a failed attempt', async () => {
    vi.useFakeTimers()

    const run = vi.fn(async () => {
      throw new Error('offline')
    })
    const poller = startFeedPoll(run, {
      intervalMs: 1_000,
      jitterMs: 0,
      random: () => 0.5,
    })

    await vi.advanceTimersByTimeAsync(1_000)
    expect(run).toHaveBeenCalledTimes(2)

    poller.stop()
  })

  it('loads once and never schedules another cycle when polling is off', async () => {
    vi.useFakeTimers()

    const run = vi.fn(async () => {})
    const poller = startFeedPoll(run, {
      intervalMs: 1_000,
      jitterMs: 0,
      random: () => 0.5,
      poll: false,
    })

    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(run).toHaveBeenCalledTimes(1)

    poller.stop()
  })
})
