import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { QueueItem } from '../types/queue'

const DB_NAME = 'floodintel-offline'
const DB_VERSION = 1

export const MAX_QUEUE_ITEMS = 50
export const MAX_QUEUE_BYTES = 100 * 1024 * 1024

interface OfflineDb extends DBSchema {
  queue: {
    key: string
    value: QueueItem
    indexes: {
      byStatus: string
      byCreatedAt: number
      byUser: number
    }
  }
  meta: {
    key: string
    value: string
  }
}

export class QueueFullError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QueueFullError'
  }
}

type QueueListener = () => void

const listeners = new Set<QueueListener>()
let channel: BroadcastChannel | null = null
let dbPromise: Promise<IDBPDatabase<OfflineDb>> | null = null

function getDb(): Promise<IDBPDatabase<OfflineDb>> {
  if (dbPromise === null) {
    dbPromise = openDB<OfflineDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const queue = db.createObjectStore('queue', { keyPath: 'id' })
        queue.createIndex('byStatus', 'status')
        queue.createIndex('byCreatedAt', 'createdAt')
        queue.createIndex('byUser', 'userId')
        db.createObjectStore('meta')
      },
    })
  }

  return dbPromise
}

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null
  }

  if (channel === null) {
    channel = new BroadcastChannel('floodintel-queue')
    channel.onmessage = () => {
      for (const listener of listeners) {
        listener()
      }
    }
  }

  return channel
}

function notify(): void {
  for (const listener of listeners) {
    listener()
  }

  getChannel()?.postMessage('changed')
}

export function subscribeToQueue(listener: QueueListener): () => void {
  listeners.add(listener)
  getChannel()

  return () => {
    listeners.delete(listener)
  }
}

export function exceedsQueueLimit(
  count: number,
  bytes: number,
  incomingBytes: number,
): boolean {
  return (
    count >= MAX_QUEUE_ITEMS ||
    bytes + incomingBytes > MAX_QUEUE_BYTES
  )
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

export async function enqueue(item: QueueItem): Promise<void> {
  const db = await getDb()

  try {
    const tx = db.transaction('queue', 'readwrite')
    const items = await tx.store.getAll()
    const bytes = items.reduce((total, entry) => total + entry.photoBytes, 0)

    if (exceedsQueueLimit(items.length, bytes, item.photoBytes)) {
      throw new QueueFullError(
        'The offline queue is full. Connect to the internet to send the saved reports before adding more.',
      )
    }

    await tx.store.put(item)
    await tx.done
  } catch (err) {
    if (err instanceof QueueFullError) {
      throw err
    }

    if (isQuotaError(err)) {
      throw new QueueFullError(
        'This device has no storage left for offline reports. Free up space and try again.',
      )
    }

    throw err
  }

  notify()
}

export async function listQueue(userId?: number): Promise<QueueItem[]> {
  const db = await getDb()
  const items =
    userId === undefined
      ? await db.getAllFromIndex('queue', 'byCreatedAt')
      : await db.getAllFromIndex('queue', 'byUser', userId)

  return items.sort((left, right) => left.createdAt - right.createdAt)
}

export async function getQueueItem(id: string): Promise<QueueItem | null> {
  const db = await getDb()

  return (await db.get('queue', id)) ?? null
}

export async function updateQueueItem(
  id: string,
  patch: Partial<QueueItem>,
): Promise<QueueItem | null> {
  const db = await getDb()
  const existing = await db.get('queue', id)

  if (existing === undefined) {
    return null
  }

  const updated: QueueItem = { ...existing, ...patch }
  await db.put('queue', updated)
  notify()

  return updated
}

export async function removeQueueItem(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('queue', id)
  notify()
}

export async function countPending(userId?: number): Promise<number> {
  const items = await listQueue(userId)

  return items.filter((item) => item.status !== 'failed').length
}

export async function clearQueueForUser(userId: number): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('queue', 'readwrite')
  const items = await tx.store.index('byUser').getAll(userId)

  await Promise.all(items.map((item) => tx.store.delete(item.id)))
  await tx.done
  notify()
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb()
  await db.put('meta', value, key)
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb()

  return (await db.get('meta', key)) ?? null
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || navigator.storage?.persist === undefined) {
    return false
  }

  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function getStorageUsage(): Promise<{
  usage: number
  quota: number | null
}> {
  if (typeof navigator === 'undefined' || navigator.storage?.estimate === undefined) {
    return { usage: 0, quota: null }
  }

  try {
    const estimate = await navigator.storage.estimate()

    return {
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? null,
    }
  } catch {
    return { usage: 0, quota: null }
  }
}

export async function isQueueStorageAvailable(): Promise<boolean> {
  try {
    await getDb()

    return true
  } catch {
    return false
  }
}

export async function closeQueue(): Promise<void> {
  if (dbPromise === null) {
    return
  }

  try {
    const db = await dbPromise
    db.close()
  } catch {
    // Ignore close failures.
  } finally {
    dbPromise = null
  }
}
