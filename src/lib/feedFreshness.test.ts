import { describe, expect, it } from 'vitest'
import {
  FEED_POLL_INTERVAL_MS,
  FEED_POLL_JITTER_MS,
  FEED_STALE_AFTER_MS,
  describeFreshness,
} from './feedFreshness'

const T0 = Date.UTC(2026, 9, 31, 8, 0, 0)

describe('describeFreshness', () => {
  it('waits for the first update instead of claiming freshness', () => {
    const view = describeFreshness(null, T0)

    expect(view.state).toBe('pending')
    expect(view.ageSeconds).toBeNull()
    expect(view.label).toBe('Waiting for the first update')
    expect(view.note).toContain('not live')
  })

  it('reports the age of the last successful update', () => {
    expect(describeFreshness(T0, T0).label).toBe('Updated just now')
    expect(describeFreshness(T0, T0 + 12_000).label).toBe('Updated 12s ago')
    expect(
      describeFreshness(T0, T0 + 125_000, { staleAfterMs: 600_000 }).label,
    ).toBe('Updated 2m 5s ago')
  })

  it('stays fresh for one whole cycle, jitter included', () => {
    const view = describeFreshness(
      T0,
      T0 + FEED_POLL_INTERVAL_MS + FEED_POLL_JITTER_MS,
    )

    expect(view.state).toBe('fresh')
    expect(FEED_STALE_AFTER_MS).toBe(FEED_POLL_INTERVAL_MS + FEED_POLL_JITTER_MS)
  })

  it('turns stale once the interval is exceeded and states the next action', () => {
    const view = describeFreshness(T0, T0 + FEED_STALE_AFTER_MS + 1_000)

    expect(view.state).toBe('stale')
    expect(view.label).toBe('Updated 37s ago — stale')
    expect(view.note).toContain('Not live')
    expect(view.note).toContain('retries every 30s')
    expect(view.note).toContain('check your connection')
  })

  it('never returns a stopped feed to fresh', () => {
    const states: string[] = []

    for (let second = 0; second <= 120; second += 1) {
      states.push(describeFreshness(T0, T0 + second * 1_000).state)
    }

    const firstStale = states.indexOf('stale')

    expect(states[0]).toBe('fresh')
    expect(firstStale).toBeGreaterThan(0)
    expect(states.slice(firstStale).every((state) => state === 'stale')).toBe(
      true,
    )
  })

  it('labels every substitute state as not live', () => {
    for (const lastSuccessAt of [null, T0]) {
      const view = describeFreshness(lastSuccessAt, T0 + 60_000)

      expect(view.note).toMatch(/not live/i)
      expect(view.label.toLowerCase()).not.toContain('live')
    }
  })

  it('says live only while the subscription is connected', () => {
    const waiting = describeFreshness(null, T0, { live: true })

    expect(waiting.state).toBe('live')
    expect(waiting.label).toBe('Waiting for the first update')
    expect(waiting.note).toContain('Live')
    expect(waiting.note).toContain('falls back to polling every 30s')

    const recent = describeFreshness(T0, T0 + 12_000, { live: true })

    expect(recent.state).toBe('live')
    expect(recent.label).toBe('Updated 12s ago')
    expect(recent.note).toContain('Live')
    expect(recent.note).toContain('updates arrive without a refresh')
  })

  it('does not call a connected feed stale just because it is quiet', () => {
    const view = describeFreshness(T0, T0 + 10 * 60_000, { live: true })

    expect(view.state).toBe('live')
    expect(view.label).toBe('Updated 10m ago')
  })
})
