import { describe, expect, it } from 'vitest'
import { deliverQueuedItem } from './queueDelivery'
import type { DeliveryDeps } from './queueDelivery'
import type { SyncSummary } from './sync'
import type { LevelQueueItem, QueueItem, QueueOutcome } from '../types/queue'

function makeItem(overrides: Partial<LevelQueueItem> = {}): LevelQueueItem {
  return {
    id: 'attempt',
    userId: 1,
    kind: 'level',
    payload: {
      flood_level: null,
      alert_level: 'get_ready',
      flood_type: 'ponding',
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

function outcome(
  status: QueueOutcome['status'],
  message: string,
  reportId: number | null = null,
): QueueOutcome {
  return { id: 'attempt', status, message, reportId, at: 1 }
}

function summary(
  outcomes: QueueOutcome[],
  remaining: number,
): SyncSummary {
  return {
    sent: 0,
    merged: 0,
    failed: 0,
    remaining,
    authRequired: false,
    authStale: false,
    outcomes,
  }
}

describe('deliverQueuedItem', () => {
  it('keeps a rejected report with its photo and the server message', async () => {
    const item = makeItem()
    const store = new Map<string, QueueItem>()

    const deps: DeliveryDeps = {
      enqueue: async (entry) => {
        store.set(entry.id, entry)
      },
      get: async (id) => store.get(id) ?? null,
      // The sync engine's 422 contract: mark the record failed, keep it.
      sync: async () => {
        const stored = store.get(item.id)

        if (stored !== undefined) {
          store.set(item.id, {
            ...stored,
            status: 'failed',
            attempts: 1,
            lastError: 'The notes field is required.',
          })
        }

        return summary(
          [outcome('failed', 'The notes field is required.')],
          1,
        )
      },
      online: () => true,
    }

    const result = await deliverQueuedItem(item, undefined, deps)

    expect(result.failed).toBe(true)
    expect(result.queued).toBe(true)
    expect(result.message).toBe('The notes field is required.')

    const stored = store.get(item.id)
    expect(stored?.status).toBe('failed')
    expect(stored?.photoBytes).toBe(8)
  })

  it('reports a sent report and leaves nothing queued', async () => {
    const item = makeItem()
    const store = new Map<string, QueueItem>()

    const deps: DeliveryDeps = {
      enqueue: async (entry) => {
        store.set(entry.id, entry)
      },
      get: async (id) => store.get(id) ?? null,
      sync: async () => {
        store.delete(item.id)

        return summary([outcome('sent', 'Report #9 sent.', 9)], 0)
      },
      online: () => true,
    }

    const result = await deliverQueuedItem(item, undefined, deps)

    expect(result.failed).toBe(false)
    expect(result.queued).toBe(false)
    expect(result.reportId).toBe(9)
    expect(store.size).toBe(0)
  })

  it('replaces the attempt it grew from when a payload is corrected', async () => {
    const item = makeItem()
    const replaceIds: Array<string | undefined> = []

    const deps: DeliveryDeps = {
      enqueue: async (_entry, replaceId) => {
        replaceIds.push(replaceId)
      },
      get: async () => item,
      sync: async () => summary([], 1),
      online: () => true,
    }

    await deliverQueuedItem(item, 'attempt', deps)

    expect(replaceIds).toEqual(['attempt'])
  })

  it('leaves the report queued when the device is offline', async () => {
    const item = makeItem()

    const deps: DeliveryDeps = {
      enqueue: async () => undefined,
      get: async () => item,
      sync: async () => summary([], 1),
      online: () => false,
    }

    const result = await deliverQueuedItem(item, undefined, deps)

    expect(result.queued).toBe(true)
    expect(result.failed).toBe(false)
    expect(result.message).toBe(
      'Saved on this device. It will send automatically when online.',
    )
  })

  it('checks once more when the first pass reported work remaining', async () => {
    const item = makeItem()
    let calls = 0

    const deps: DeliveryDeps = {
      enqueue: async () => undefined,
      get: async () => null,
      sync: async () => {
        calls += 1

        return calls === 1
          ? summary([], 1)
          : summary([outcome('sent', 'Report #4 sent.', 4)], 0)
      },
      online: () => true,
    }

    const result = await deliverQueuedItem(item, undefined, deps)

    expect(calls).toBe(2)
    expect(result.reportId).toBe(4)
    expect(result.queued).toBe(false)
  })
})
