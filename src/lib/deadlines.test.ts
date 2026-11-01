import { describe, expect, it, vi } from 'vitest'
import {
  cacheDeadlines,
  describeBasis,
  formatCountdown,
  readCachedDeadlines,
  remainingSeconds,
} from './deadlines'
import type { DeadlinesPayload } from './deadlines'

function memoryStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear: () => {
      store.clear()
    },
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
}

const PAYLOAD: DeadlinesPayload = {
  timezone: 'Asia/Manila',
  cutoffs: ['04:00', '15:00'],
  now: '2026-11-02T14:00:00+08:00',
  window: {
    starts_at: '2026-11-02T04:00:00+08:00',
    next_cutoff_at: '2026-11-02T15:00:00+08:00',
    label: '4:00 AM – 3:00 PM',
  },
  pending: {
    basis: 'reported_at',
    total: 3,
    by_barangay: [
      { barangay_id: 1, barangay: 'Aplaya', pending: 2 },
      { barangay_id: 2, barangay: 'Balite', pending: 1 },
    ],
  },
}

describe('consolidation deadline countdown', () => {
  it('counts down from the server instants, not the device clock', () => {
    expect(
      remainingSeconds(PAYLOAD.window.next_cutoff_at, PAYLOAD.now, 0),
    ).toBe(3600)
    expect(
      remainingSeconds(PAYLOAD.window.next_cutoff_at, PAYLOAD.now, 60),
    ).toBe(3540)
  })

  it('clamps at zero once the cutoff passes', () => {
    expect(
      remainingSeconds(PAYLOAD.window.next_cutoff_at, PAYLOAD.now, 4000),
    ).toBe(0)
  })

  it('formats hours, minutes, and seconds', () => {
    expect(formatCountdown(0)).toBe('0:00')
    expect(formatCountdown(59)).toBe('0:59')
    expect(formatCountdown(65)).toBe('1:05')
    expect(formatCountdown(3661)).toBe('1:01:01')
    expect(formatCountdown(-5)).toBe('0:00')
  })

  it('states which instant the pending count was taken from', () => {
    expect(describeBasis('reported_at')).toContain('observation time')
    expect(describeBasis('reported_at_with_created_at_fallback')).toContain(
      'receipt time',
    )
  })
})

describe('deadline cache', () => {
  it('round-trips the last known payload for the offline panel', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    cacheDeadlines(PAYLOAD, 1_700_000_000_000)

    expect(readCachedDeadlines()).toEqual({
      payload: PAYLOAD,
      fetchedAt: 1_700_000_000_000,
    })

    vi.unstubAllGlobals()
  })

  it('ignores a malformed cache entry instead of throwing', () => {
    const storage = memoryStorage()
    storage.setItem('floodintel:deadlines', '{not json')
    vi.stubGlobal('localStorage', storage)

    expect(readCachedDeadlines()).toBeNull()

    vi.unstubAllGlobals()
  })
})
