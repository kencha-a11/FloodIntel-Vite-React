import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_QUEUE_ITEMS,
  QueueFullError,
  clearQueueForUser,
  countPending,
  countPendingItems,
  enqueue,
  getQueueItem,
  listQueue,
  removeQueueItem,
} from './offlineQueue'
import type { LevelQueueItem } from '../types/queue'

function makeItem(overrides: Partial<LevelQueueItem> = {}): LevelQueueItem {
  return {
    id: `item-${Math.random().toString(16).slice(2)}`,
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

beforeEach(async () => {
  await clearQueueForUser(1)
})

describe('enqueue replacement', () => {
  it('replaces a rejected attempt instead of queueing a second copy', async () => {
    await enqueue(makeItem({ id: 'attempt', status: 'failed', attempts: 1 }))

    await enqueue(
      makeItem({ id: 'resubmission', createdAt: 2, photoBytes: 16 }),
      'attempt',
    )

    const stored = await listQueue(1)

    expect(stored.map((item) => item.id)).toEqual(['resubmission'])
    expect(stored[0].status).toBe('queued')
    expect(stored[0].photoBytes).toBe(16)
    expect(await getQueueItem('attempt')).toBeNull()
  })

  it('allows the replacement when the item cap is reached', async () => {
    for (let index = 0; index < MAX_QUEUE_ITEMS; index += 1) {
      await enqueue(
        makeItem({ id: `item-${index}`, createdAt: index, photoBytes: 1 }),
      )
    }

    await expect(
      enqueue(
        makeItem({ id: 'item-0-resubmission', createdAt: 0, photoBytes: 1 }),
        'item-0',
      ),
    ).resolves.toBeUndefined()

    await expect(
      enqueue(makeItem({ id: 'overflow', photoBytes: 1 })),
    ).rejects.toBeInstanceOf(QueueFullError)
  })
})

describe('pending count', () => {
  it('excludes failed items while the listing keeps them', async () => {
    await enqueue(makeItem({ id: 'waiting', createdAt: 1 }))
    await enqueue(makeItem({ id: 'rejected', createdAt: 2, status: 'failed' }))
    await enqueue(makeItem({ id: 'blocked', createdAt: 3, status: 'blocked' }))

    expect(await countPending(1)).toBe(2)
    expect(countPendingItems(await listQueue(1))).toBe(2)
    expect(await listQueue(1)).toHaveLength(3)
  })

  it('counts only items awaiting transmission', () => {
    expect(
      countPendingItems([
        makeItem({ id: 'queued' }),
        makeItem({ id: 'failed', status: 'failed' }),
      ]),
    ).toBe(1)
    expect(countPendingItems([])).toBe(0)
  })
})

describe('discard', () => {
  it('removes a failed report and leaves the others', async () => {
    await enqueue(makeItem({ id: 'rejected', status: 'failed' }))
    await enqueue(makeItem({ id: 'keep', createdAt: 2 }))

    await removeQueueItem('rejected')

    expect(await getQueueItem('rejected')).toBeNull()
    expect(await listQueue(1)).toHaveLength(1)
  })
})
