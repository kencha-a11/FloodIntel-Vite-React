import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_QUEUE_BYTES,
  MAX_QUEUE_ITEMS,
  QueueFullError,
  clearQueueForUser,
  enqueue,
  exceedsQueueLimit,
  getQueueItem,
  listQueue,
  removeQueueItem,
  updateQueueItem,
} from './offlineQueue'
import type { QueueItem } from '../types/queue'

function makeItem(overrides: Partial<QueueItem> = {}): QueueItem {
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
  await clearQueueForUser(2)
})

describe('offline queue', () => {
  it('stores and lists items oldest first for one user', async () => {
    const newer = makeItem({ userId: 1, createdAt: 2000, id: 'newer' })
    const older = makeItem({ userId: 1, createdAt: 1000, id: 'older' })
    const other = makeItem({ userId: 2, createdAt: 500, id: 'other' })

    await enqueue(newer)
    await enqueue(older)
    await enqueue(other)

    expect((await listQueue(1)).map((item) => item.id)).toEqual([
      'older',
      'newer',
    ])
    expect((await listQueue(2)).map((item) => item.id)).toEqual(['other'])
  })

  it('updates and removes items', async () => {
    const item = makeItem({ id: 'update-me' })
    await enqueue(item)

    const updated = await updateQueueItem('update-me', {
      status: 'syncing',
      attempts: 2,
    })

    expect(updated?.status).toBe('syncing')
    expect(updated?.attempts).toBe(2)
    expect((await getQueueItem('update-me'))?.status).toBe('syncing')

    await removeQueueItem('update-me')

    expect(await getQueueItem('update-me')).toBeNull()
  })

  it('returns null when updating a missing item', async () => {
    expect(await updateQueueItem('missing', { status: 'failed' })).toBeNull()
  })

  it('rejects the 51st queued item', async () => {
    for (let index = 0; index < MAX_QUEUE_ITEMS; index += 1) {
      await enqueue(
        makeItem({ id: `item-${index}`, createdAt: index, photoBytes: 1 }),
      )
    }

    await expect(
      enqueue(makeItem({ id: 'overflow', photoBytes: 1 })),
    ).rejects.toBeInstanceOf(QueueFullError)
  })

  it('clears only the requested user', async () => {
    await enqueue(makeItem({ userId: 1, id: 'mine' }))
    await enqueue(makeItem({ userId: 2, id: 'theirs' }))

    await clearQueueForUser(1)

    expect(await listQueue(1)).toEqual([])
    expect((await listQueue(2)).map((item) => item.id)).toEqual(['theirs'])
  })
})

describe('exceedsQueueLimit', () => {
  it('rejects when the item cap is reached', () => {
    expect(exceedsQueueLimit(MAX_QUEUE_ITEMS, 0, 1)).toBe(true)
    expect(exceedsQueueLimit(MAX_QUEUE_ITEMS - 1, 0, 1)).toBe(false)
  })

  it('rejects when the byte cap would be exceeded', () => {
    expect(exceedsQueueLimit(1, MAX_QUEUE_BYTES, 1)).toBe(true)
    expect(exceedsQueueLimit(1, MAX_QUEUE_BYTES - 10, 10)).toBe(false)
  })
})
