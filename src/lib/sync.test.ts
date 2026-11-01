import { describe, expect, it } from 'vitest'
import {
  MAX_AUTO_ATTEMPTS,
  backoffDelay,
  correctedObservationTime,
  hasExhaustedRetries,
  isReplayMatch,
  restartQueueItemPatch,
  runSync,
  terminalRetryMessage,
} from './sync'
import type { SyncDeps } from './sync'
import { AuthApiError } from './http'
import { LAST_RESORT_PHOTO_BYTES } from './floodLevels'
import { AUTH_WINDOW_MS } from './session'
import type { LevelQueueItem, QueueItem } from '../types/queue'
import type { FloodReport } from '../types/report'

const NOW = 1_700_000_000_000

function makeItem(overrides: Partial<LevelQueueItem> = {}): LevelQueueItem {
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
  if (item.kind !== 'level') {
    throw new Error('makeReport only builds level reports.')
  }

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
    alert_level: item.payload.alert_level ?? null,
    alert_level_label: null,
    alert_severity: null,
    flood_type: item.payload.flood_type ?? null,
    flood_type_label: null,
    depth_cm: item.payload.depth_cm ?? null,
    landmark: item.payload.landmark ?? null,
    latitude: item.payload.latitude,
    longitude: item.payload.longitude,
    gps_accuracy: item.payload.gps_accuracy,
    address: null,
    photo_url: '/storage/flood.jpg',
    notes: item.payload.notes,
    reported_at: item.payload.reported_at ?? item.observedAt,
    status: 'submitted',
    status_label: 'Submitted',
    anomaly_flags: [],
    rejection_reason: null,
    rejected_at: null,
    supersedes_id: null,
    created_at: item.observedAt,
    ...overrides,
  }
}

function shrunkPhoto() {
  const blob = new Blob([new Uint8Array(64)], { type: 'image/jpeg' })

  return {
    blob,
    width: 800,
    height: 600,
    originalBytes: 2 * 1024 * 1024,
    bytes: blob.size,
    quality: 0.6,
    edge: 1280,
    meetsTarget: true,
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

      const updated = { ...existing, ...patch } as QueueItem
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
    random: () => 0.5,
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

  it('corrects the transmitted instant when the server rejects the clock', async () => {
    let calls = 0
    const SKEW_MS = 60 * 60_000
    const serverNow = NOW - SKEW_MS
    const observedAt = new Date(NOW - 60_000).toISOString()
    const correctedAt = new Date(serverNow - 60_000).toISOString()

    const harness = createHarness([makeItem({ observedAt })], {
      send: async (_token, item) => {
        calls += 1

        if (item.kind !== 'level') {
          throw new Error('expected a level item')
        }

        const reportedAt = item.payload.reported_at

        if (reportedAt === null || Date.parse(reportedAt) > serverNow) {
          throw new AuthApiError(
            'The reported at field must not be in the future.',
            422,
            { reported_at: ['The reported at field must not be in the future.'] },
            null,
            serverNow,
          )
        }

        return makeReport(item, { reported_at: reportedAt })
      },
    })
    const first = await runSync(1, harness.deps)
    const repaired = harness.store.get('item-1')

    expect(calls).toBe(1)
    expect(first.sent).toBe(0)
    expect(first.outcomes[0].status).toBe('queued')
    expect(repaired?.payload.reported_at).toBe(correctedAt)
    expect(repaired?.observedAt).toBe(observedAt)
    expect(repaired?.clockSkewMs).toBe(SKEW_MS)
    expect(repaired?.status).toBe('queued')
    expect(repaired?.lastError).toContain('60 min ahead')
    expect(first.outcomes[0].message).toContain('corrected observation time')

    const second = await runSync(1, harness.deps)

    expect(calls).toBe(2)
    expect(second.sent).toBe(1)
    expect(harness.store.size).toBe(0)
  })

  it('fails a second clock rejection with a clock message and keeps the item', async () => {
    const harness = createHarness(
      [makeItem({ clockSkewMs: 60 * 60_000 })],
      {
        send: async () => {
          throw new AuthApiError(
            'The reported at field must not be in the future.',
            422,
            { reported_at: ['The reported at field must not be in the future.'] },
            null,
            NOW,
          )
        },
      },
    )
    const summary = await runSync(1, harness.deps)
    const item = harness.store.get('item-1')

    expect(item?.status).toBe('failed')
    expect(item?.photoBytes).toBe(8)
    expect(item?.lastError).toContain('corrected observation time was rejected')
    expect(summary.failed).toBe(1)
    expect(summary.remaining).toBe(1)
  })

  it('never nulls the instant when the server does not report its time', async () => {
    const harness = createHarness([makeItem()], {
      send: async () => {
        throw new AuthApiError(
          'The reported at field must not be in the future.',
          422,
          { reported_at: ['The reported at field must not be in the future.'] },
        )
      },
    })
    const summary = await runSync(1, harness.deps)
    const item = harness.store.get('item-1')

    expect(item?.payload.reported_at).toBe('2026-10-21T02:00:00.000Z')
    expect(item?.status).toBe('failed')
    expect(item?.lastError).toContain('device clock cannot be corrected')
    expect(summary.failed).toBe(1)
  })

  it('clamps a corrected instant to the server clock', () => {
    const observedAt = '2026-10-21T02:00:00.000Z'

    expect(
      correctedObservationTime(
        observedAt,
        -30 * 60_000,
        Date.parse('2026-10-21T01:30:00.000Z'),
      ),
    ).toBe('2026-10-21T01:30:00.000Z')
    expect(
      correctedObservationTime(
        observedAt,
        0,
        Date.parse('2026-10-21T02:05:00.000Z'),
      ),
    ).toBe(observedAt)
    expect(correctedObservationTime('not-a-date', 0, NOW)).toBe(
      'not-a-date',
    )
  })

  it('keeps a content rejection failed instead of shrinking the photo', async () => {
    let compressions = 0
    const harness = createHarness([makeItem({ photoBytes: 900_000 })], {
      send: async () => {
        throw new AuthApiError('Invalid photo.', 422, {
          photo: ['Invalid photo.'],
        })
      },
      compressPhoto: async () => {
        compressions += 1
        return shrunkPhoto()
      },
    })
    const summary = await runSync(1, harness.deps)
    const item = harness.store.get('item-1')

    expect(compressions).toBe(0)
    expect(item?.status).toBe('failed')
    expect(item?.lastError).toBe('Invalid photo.')
    expect(item?.photoBytes).toBe(900_000)
    expect(summary.failed).toBe(1)
    expect(summary.remaining).toBe(1)
  })

  it('reduces the photo when the server names a size rejection', async () => {
    const harness = createHarness(
      [makeItem({ photoBytes: 2 * 1024 * 1024 })],
      {
        send: async () => {
          throw new AuthApiError(
            'The photo is larger than the 5 MB upload limit.',
            422,
            {
              photo: ['The photo is larger than the 5 MB upload limit.'],
              photo_size: ['The photo is larger than the 5 MB upload limit.'],
            },
          )
        },
        compressPhoto: async () => shrunkPhoto(),
      },
    )

    const summary = await runSync(1, harness.deps)
    const item = harness.store.get('item-1')

    expect(item?.status).toBe('queued')
    expect(item?.photoBytes).toBe(64)
    expect(item?.nextAttemptAt).toBeNull()
    expect(summary.outcomes[0]).toMatchObject({
      status: 'queued',
      message: 'Photo reduced and queued for retry.',
    })
  })

  it('reduces the photo when a proxy answers 413', async () => {
    const harness = createHarness(
      [makeItem({ photoBytes: 2 * 1024 * 1024 })],
      {
        send: async () => {
          throw new AuthApiError('Too large.', 413)
        },
        compressPhoto: async () => shrunkPhoto(),
      },
    )

    await runSync(1, harness.deps)

    expect(harness.store.get('item-1')?.photoBytes).toBe(64)
    expect(harness.store.get('item-1')?.status).toBe('queued')
  })

  it('stops shrinking at the last-resort size and names the next action', async () => {
    let compressions = 0
    const harness = createHarness(
      [makeItem({ photoBytes: LAST_RESORT_PHOTO_BYTES })],
      {
        send: async () => {
          throw new AuthApiError(
            'The photo is larger than the 5 MB upload limit.',
            422,
            {
              photo_size: ['The photo is larger than the 5 MB upload limit.'],
            },
          )
        },
        compressPhoto: async () => {
          compressions += 1
          return shrunkPhoto()
        },
      },
    )

    await runSync(1, harness.deps)
    const item = harness.store.get('item-1')

    expect(compressions).toBe(0)
    expect(item?.status).toBe('failed')
    expect(item?.photoBytes).toBe(LAST_RESORT_PHOTO_BYTES)
    expect(item?.lastError).toBe(
      'The photo is too large to send and cannot be reduced further. Take a new photo.',
    )
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

  it('keeps retrying below the ceiling', async () => {
    const harness = createHarness([makeItem({ attempts: 6 })], {
      send: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    const summary = await runSync(1, harness.deps)
    const item = harness.store.get('item-1')

    expect(item?.status).toBe('queued')
    expect(item?.attempts).toBe(7)
    expect(item?.nextAttemptAt).toBe(NOW + 60 * 60_000)
    expect(summary.outcomes[0].status).toBe('queued')
  })

  it('gives up on a network failure at the ceiling and keeps the photo', async () => {
    const harness = createHarness([makeItem({ attempts: 7 })], {
      send: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    const summary = await runSync(1, harness.deps)
    const item = harness.store.get('item-1')

    expect(item?.status).toBe('failed')
    expect(item?.attempts).toBe(MAX_AUTO_ATTEMPTS)
    expect(item?.nextAttemptAt).toBeNull()
    expect(item?.photoBytes).toBe(8)
    expect(item?.kind === 'level' ? item.payload.flood_level : null).toBe(
      'knee',
    )
    expect(item?.lastError).toBe(
      'Failed to fetch. Stopped retrying automatically after 8 attempts. Retry when you are ready, or discard this report.',
    )
    expect(summary.failed).toBe(1)
    expect(summary.remaining).toBe(1)
    expect(summary.outcomes[0].status).toBe('failed')
  })

  it('gives up on a blocked account at the ceiling', async () => {
    const harness = createHarness([makeItem({ attempts: 7 })], {
      send: async () => {
        throw new AuthApiError('Your account is not verified.', 403)
      },
    })
    const summary = await runSync(1, harness.deps)
    const item = harness.store.get('item-1')

    expect(item?.status).toBe('failed')
    expect(item?.attempts).toBe(MAX_AUTO_ATTEMPTS)
    expect(item?.nextAttemptAt).toBeNull()
    expect(item?.lastError).toContain('Stopped retrying automatically')
    expect(summary.failed).toBe(1)
  })

  it('gives up on rate limiting at the ceiling', async () => {
    const harness = createHarness([makeItem({ attempts: 7 })], {
      send: async () => {
        throw new AuthApiError('Too many requests.', 429, {}, 30)
      },
    })
    const summary = await runSync(1, harness.deps)
    const item = harness.store.get('item-1')

    expect(item?.status).toBe('failed')
    expect(item?.attempts).toBe(MAX_AUTO_ATTEMPTS)
    expect(item?.nextAttemptAt).toBeNull()
    expect(summary.outcomes[0].status).toBe('failed')
  })

  it('sends a terminal item again after a manual retry resets its budget', async () => {
    const harness = createHarness([
      makeItem({ status: 'failed', attempts: MAX_AUTO_ATTEMPTS }),
    ])

    await harness.deps.update('item-1', restartQueueItemPatch())

    const summary = await runSync(1, harness.deps, { force: true })

    expect(harness.store.size).toBe(0)
    expect(summary.sent).toBe(1)
  })
})

describe('retry budget helpers', () => {
  it('reports exhaustion at the documented attempt count', () => {
    expect(hasExhaustedRetries(MAX_AUTO_ATTEMPTS - 1)).toBe(false)
    expect(hasExhaustedRetries(MAX_AUTO_ATTEMPTS)).toBe(true)
    expect(hasExhaustedRetries(MAX_AUTO_ATTEMPTS + 1)).toBe(true)
  })

  it('names the cause and the next action in the terminal message', () => {
    expect(terminalRetryMessage('Failed to fetch')).toBe(
      'Failed to fetch. Stopped retrying automatically after 8 attempts. Retry when you are ready, or discard this report.',
    )
    expect(terminalRetryMessage('Server error.')).toBe(
      'Server error. Stopped retrying automatically after 8 attempts. Retry when you are ready, or discard this report.',
    )
    expect(terminalRetryMessage(null)).toBe(
      'Stopped retrying automatically after 8 attempts. Retry when you are ready, or discard this report.',
    )
  })

  it('resets the budget so the next failure starts a fresh ladder', () => {
    expect(restartQueueItemPatch()).toEqual({
      status: 'queued',
      attempts: 0,
      nextAttemptAt: null,
      lastError: null,
    })
  })
})

describe('backoffDelay', () => {
  it('grows with attempts and caps at one hour', () => {
    expect(backoffDelay(1, () => 0.5)).toBe(15_000)
    expect(backoffDelay(2, () => 0.5)).toBe(60_000)
    expect(backoffDelay(6, () => 0.5)).toBe(60 * 60_000)
    expect(backoffDelay(50, () => 0.5)).toBe(60 * 60_000)
  })

  it('treats a zero attempt count as the first attempt', () => {
    expect(backoffDelay(0, () => 0.5)).toBe(15_000)
  })

  it('spreads each rung by at most twenty percent either way', () => {
    expect(backoffDelay(1, () => 0)).toBe(12_000)
    expect(backoffDelay(1, () => 1)).toBe(18_000)
    expect(backoffDelay(6, () => 0)).toBe(48 * 60_000)
    expect(backoffDelay(6, () => 1)).toBe(72 * 60_000)
  })
})

describe('isReplayMatch', () => {
  it('matches the same report captured on this device', () => {
    const item = makeItem()

    expect(isReplayMatch(makeReport(item), item)).toBe(true)
  })

  it('never matches an impact item against a level report', () => {
    const impact = {
      ...makeItem(),
      kind: 'impact' as const,
      payload: {
        event_id: 3,
        families: 10,
        individuals: 42,
        remarks: null,
        reported_at: '2026-10-21T02:00:00.000Z',
      },
    }

    expect(isReplayMatch(makeReport(makeItem()), impact)).toBe(false)
  })

  it('never matches a correction against the report it answers', () => {
    const item = makeItem()
    item.payload.supersedes_id = 12
    const correction = { ...makeReport(item), id: 12 }

    expect(isReplayMatch(correction, item)).toBe(false)
    expect(isReplayMatch({ ...correction, id: 13 }, item)).toBe(true)
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
