import { describe, expect, it } from 'vitest'
import {
  backoffDelay,
  isReplayMatch,
  runSync,
} from './sync'
import type { SyncDeps } from './sync'
import { AuthApiError } from './http'
import { AUTH_WINDOW_MS } from './session'
import type { QueueItem } from '../types/queue'
import type { FloodReport } from '../types/report'

const NOW = 1_700_000_000_000

function makeItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 'item-1',
    userId: 1,
    kind: 'level',
    payload: {
      flood_level: 'knee',
      latitude: 14.5995,
      longitude: 120.9842,
      gps_accuracy: 8,
      notes: null,
      reported_at: '2026-10-21T02:00:00.000Z',
    },
    photo: new ArrayBuffer(8),
    photoType: 'image/jpeg',
    photoName: 'flood.jpg',
    photoBytes: 8,
    status: 'queued',
    attempts: 0,
    lastError: null,
    nextAttemptAt: null,
    createdAt: 1,
    observedAt: '2026-10-21T02:00:00.000Z',
    ...overrides,
  }
}

function makeReport(
  item: QueueItem,
  overrides: Partial<FloodReport> = {},
): FloodReport {
  return {
    id: 99,
    user: {
      id: item.userId,
      first_name: 'Test',
      last_name: 'Tanod',
      role: 'barangay_tanod',
    },
    barangay: { id: 1, name: 'Barangay Test' },
    flood_level: item.payload.flood_level,
    flood_level_label: 'Knee-deep',
    severity: 2,
    latitude: item.payload.latitude,
    longitude: item.payload.longitude,
    gps_accuracy: item.payload.gps_accuracy,
    address: null,
    photo_url: '/storage/flood.jpg',
    notes: item.payload.notes,
    reported_at: item.payload.reported_at ?? item.observedAt,
    status: 'submitted',
    rejection_reason: null,
    rejected_at: null,
    created_at: item.observedAt,
    ...overrides,
  }
}

interface Harness {
  deps: SyncDeps
  store: Map<string, QueueItem>
  sent: QueueItem[]
}

function createHarness(
  items: QueueItem[],
  overrides: Partial<SyncDeps> = {},
): Harness {
  const store = new Map(items.map((item) => [item.id, { ...item }]))
  const sent: QueueItem[] = []

  const deps: SyncDeps = {
    getToken: () => 'token',
    getLastAuthenticatedAt: () => NOW - 1000,
    now: () => NOW,
    sleep: async () => {},
    list: async (userId) =>
      [...store.values()]
        .filter((item) => item.userId === userId)
        .sort((left, right) => left.createdAt - right.createdAt),
    update: async (id, patch) => {
      const existing = store.get(id)

      if (existing === undefined) {
        return null
      }

      const updated = { ...existing, ...patch }
      store.set(id, updated)

      return updated
    },
    remove: async (id) => {
      store.delete(id)
    },
    send: async (_token, item) => {
      sent.push(item)

      return makeReport(item)
    },
    findDuplicate: async () => null,
    sendIntervalMs: 0,
    ...overrides,
  }

  return { deps, store, sent }
}

describe('runSync', () => {
  it('sends a queued item and removes it', async () => {
    const harness = createHarness([makeItem()])
    const summary = await runSync(1, harness.deps)

    expect(summary.sent).toBe(1)
    expect(summary.remaining).toBe(0)
    expect(harness.store.size).toBe(0)
    expect(harness.sent).toHaveLength(1)
    expect(summary.outcomes[0]).toMatchObject({
      status: 'sent',
      reportId: 99,
    })
  })

  it('does nothing without a token', async () => {
    const harness = createHarness([makeItem()], { getToken: () => null })
    const summary = await runSync(1, harness.deps)

    expect(summary.sent).toBe(0)
    expect(summary.remaining).toBe(1)
    expect(summary.outcomes).toEqual([])
  })

  it('blocks sending when the 12-hour auth window has expired', async () => {
    const harness = createHarness([makeItem()], {
      getLastAuthenticatedAt: () => NOW - AUTH_WINDOW_MS - 1,
    })
    const summary = await runSync(1, harness.deps)

    expect(summary.authStale).toBe(true)
    expect(summary.sent).toBe(0)
    expect(summary.remaining).toBe(1)
    expect(harness.sent).toEqual([])
  })

  it('marks the item as auth-required and stops on 401', async () => {
    const harness = createHarness([makeItem(), makeItem({ id: 'item-2', createdAt: 2 })], {
      send: async () => {
        throw new AuthApiError('Unauthenticated.', 401)
      },
    })
    const summary = await runSync(1, harness.deps)

    expect(summary.authRequired).toBe(true)
    expect(summary.sent).toBe(0)
    expect(summary.remaining).toBe(2)
    expect(harness.store.get('item-1')?.status).toBe('auth-required')
    expect(harness.store.get('item-2')?.status).toBe('queued')
  })

  it('blocks the item on 403', async () => {
    const harness = createHarness([makeItem()], {
      send: async () => {
        throw new AuthApiError('Your account is not verified.', 403)
      },
    })
    const summary = await runSync(1, harness.deps)
    const item = harness.store.get('item-1')

    expect(item?.status).toBe('blocked')
    expect(item?.attempts).toBe(1)
    expect(item?.nextAttemptAt).toBe(NOW + 60 * 60_000)
    expect(summary.outcomes[0].status).toBe('blocked')
  })

  it('schedules a backoff retry after a network failure', async () => {
    const harness = createHarness([makeItem()], {
      send: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    const summary = await runSync(1, harness.deps)
    const item = harness.store.get('item-1')

    expect(item?.status).toBe('queued')
    expect(item?.attempts).toBe(1)
    expect(item?.nextAttemptAt).toBe(NOW + 15_000)
    expect(summary.remaining).toBe(1)
    expect(summary.outcomes[0].status).toBe('queued')
  })

  it('retries with a null reported_at when the server rejects the clock', async () => {
    let calls = 0

    const harness = createHarness([makeItem()], {
      send: async (_token, item) => {
        calls += 1

        if (item.payload.reported_at !== null) {
          throw new AuthApiError(
            'The reported at field must not be in the future.',
            422,
            { reported_at: ['The reported at field must not be in the future.'] },
          )
        }

        return makeReport(item, { reported_at: item.observedAt })
      },
    })
    const first = await runSync(1, harness.deps)

    expect(calls).toBe(1)
    expect(first.sent).toBe(0)
    expect(first.outcomes[0].status).toBe('queued')
    expect(harness.store.get('item-1')?.payload.reported_at).toBeNull()

    const second = await runSync(1, harness.deps)

    expect(calls).toBe(2)
    expect(second.sent).toBe(1)
    expect(harness.store.size).toBe(0)
  })

  it('marks other 422 responses as failed', async () => {
    const harness = createHarness([makeItem()], {
      send: async () => {
        throw new AuthApiError('Invalid photo.', 422, {
          photo: ['Invalid photo.'],
        })
      },
    })
    const summary = await runSync(1, harness.deps)
    const item = harness.store.get('item-1')

    expect(item?.status).toBe('failed')
    expect(summary.failed).toBe(1)
    expect(summary.remaining).toBe(1)
  })

  it('merges a report found on the server after an ambiguous failure', async () => {
    const item = makeItem()
    const harness = createHarness([item], {
      send: async () => {
        throw new TypeError('Failed to fetch')
      },
      findDuplicate: async (_token, queued) => makeReport(queued),
    })
    const summary = await runSync(1, harness.deps)

    expect(summary.merged).toBe(1)
    expect(summary.remaining).toBe(0)
    expect(harness.store.size).toBe(0)
    expect(summary.outcomes[0].status).toBe('merged')
  })

  it('reconciles an interrupted syncing item on the next run', async () => {
    const item = makeItem({ status: 'syncing' })
    const harness = createHarness([item], {
      findDuplicate: async (_token, queued) => makeReport(queued),
    })
    const summary = await runSync(1, harness.deps)

    expect(summary.merged).toBe(1)
    expect(harness.sent).toEqual([])
    expect(harness.store.size).toBe(0)
  })

  it('stops the batch and retries later on 429', async () => {
    const harness = createHarness(
      [makeItem(), makeItem({ id: 'item-2', createdAt: 2 })],
      {
        send: async () => {
          throw new AuthApiError('Too many requests.', 429, {}, 30)
        },
      },
    )
    const summary = await runSync(1, harness.deps)

    expect(harness.sent).toHaveLength(0)
    expect(harness.store.get('item-1')?.nextAttemptAt).toBe(NOW + 30_000)
    expect(harness.store.get('item-2')?.status).toBe('queued')
    expect(summary.outcomes[0].status).toBe('queued')
  })

  it('skips items whose backoff has not elapsed', async () => {
    const harness = createHarness([
      makeItem({ nextAttemptAt: NOW + 60_000 }),
    ])
    const summary = await runSync(1, harness.deps)

    expect(harness.sent).toEqual([])
    expect(summary.remaining).toBe(1)
  })

  it('retries failed items only when forced', async () => {
    const harness = createHarness([makeItem({ status: 'failed' })])
    await runSync(1, harness.deps)

    expect(harness.sent).toEqual([])

    const forced = await runSync(1, harness.deps, { force: true })

    expect(forced.sent).toBe(1)
  })

  it('retries items whose backoff elapsed', async () => {
    const harness = createHarness([
      makeItem({ attempts: 1, nextAttemptAt: NOW - 1 }),
    ])
    const summary = await runSync(1, harness.deps)

    expect(summary.sent).toBe(1)
  })
})

describe('backoffDelay', () => {
  it('grows with attempts and caps at one hour', () => {
    expect(backoffDelay(1)).toBe(15_000)
    expect(backoffDelay(2)).toBe(60_000)
    expect(backoffDelay(6)).toBe(60 * 60_000)
    expect(backoffDelay(50)).toBe(60 * 60_000)
  })

  it('treats a zero attempt count as the first attempt', () => {
    expect(backoffDelay(0)).toBe(15_000)
  })
})

describe('isReplayMatch', () => {
  it('matches the same report captured on this device', () => {
    const item = makeItem()

    expect(isReplayMatch(makeReport(item), item)).toBe(true)
  })

  it('rejects reports from another user, level, place, or time', () => {
    const item = makeItem()
    const base = makeReport(item)

    expect(
      isReplayMatch(
        { ...base, user: { ...base.user, id: 2 } },
        item,
      ),
    ).toBe(false)
    expect(isReplayMatch({ ...base, flood_level: 'waist' }, item)).toBe(false)
    expect(isReplayMatch({ ...base, latitude: 14.6 }, item)).toBe(false)
    expect(
      isReplayMatch(
        { ...base, reported_at: '2026-10-21T02:00:30.000Z' },
        item,
      ),
    ).toBe(false)
  })
})
