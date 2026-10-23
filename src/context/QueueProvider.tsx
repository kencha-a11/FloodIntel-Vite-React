import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSyncExternalStore } from 'react'
import { useAuth } from './useAuth'
import { QueueContext } from './QueueContext'
import type {
  QueueContextValue,
  SubmitLevelReportInput,
  SubmitLevelReportResult,
} from './QueueContext'
import type { QueueItem } from '../types/queue'
import {
  clearQueueForUser,
  enqueue,
  getQueueItem,
  isQueueStorageAvailable,
  listQueue,
  removeQueueItem,
  requestPersistentStorage,
  subscribeToQueue,
  updateQueueItem,
} from '../lib/offlineQueue'
import {
  clearSyncOutcomes,
  getSyncState,
  startSyncEngine,
  subscribeToSync,
  syncQueue,
} from '../lib/sync'
import {
  isSyncWindowExpired,
  readLastAuthenticatedAt,
} from '../lib/session'

function newClientId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function QueueProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const syncState = useSyncExternalStore(subscribeToSync, getSyncState)
  const [items, setItems] = useState<QueueItem[]>([])
  const [storageAvailable, setStorageAvailable] = useState(true)

  const refresh = useCallback(async () => {
    if (user === null) {
      return
    }

    try {
      setItems(await listQueue(user.id))
    } catch {
      setStorageAvailable(false)
      setItems([])
    }
  }, [user])

  useEffect(() => {
    let cancelled = false

    void isQueueStorageAvailable().then((available) => {
      if (!cancelled) {
        setStorageAvailable(available)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (user === null) {
      return
    }

    let cancelled = false

    void (async () => {
      await requestPersistentStorage()

      let reset = 0

      if (
        !isSyncWindowExpired(Date.now(), readLastAuthenticatedAt())
      ) {
        const saved = await listQueue(user.id).catch(() => [])

        for (const item of saved) {
          if (item.status === 'auth-required') {
            await updateQueueItem(item.id, {
              status: 'queued',
              lastError: null,
            })
            reset += 1
          }
        }
      }

      if (!cancelled) {
        await refresh()

        if (reset > 0) {
          await syncQueue(user.id, { force: true })
        }
      }
    })()

    const unsubscribe = subscribeToQueue(() => {
      void refresh()
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [user, refresh])

  useEffect(() => {
    if (user === null) {
      return
    }

    return startSyncEngine(user.id)
  }, [user])

  const submitLevelReport = useCallback(
    async (
      input: SubmitLevelReportInput,
    ): Promise<SubmitLevelReportResult> => {
      if (user === null) {
        throw new Error('You are not signed in.')
      }

      const photoBytes = await input.photo.arrayBuffer()
      const id = newClientId()
      const item: QueueItem = {
        id,
        userId: user.id,
        kind: 'level',
        payload: input.payload,
        photo: photoBytes,
        photoType: input.photo.type === '' ? 'image/jpeg' : input.photo.type,
        photoName: input.photoName,
        photoBytes: photoBytes.byteLength,
        status: 'queued',
        attempts: 0,
        lastError: null,
        nextAttemptAt: null,
        createdAt: Date.now(),
        observedAt: input.observedAt,
      }

      await enqueue(item)
      await refresh()

      const summary = await syncQueue(user.id)
      let outcome = summary.outcomes.find((entry) => entry.id === id)

      if (
        outcome === undefined &&
        summary.remaining > 0 &&
        (typeof navigator === 'undefined' || navigator.onLine)
      ) {
        const retrySummary = await syncQueue(user.id)
        outcome = retrySummary.outcomes.find((entry) => entry.id === id)
      }

      const failed = outcome?.status === 'failed'

      if (failed) {
        await removeQueueItem(id)
      }

      const remaining = failed ? null : await getQueueItem(id)

      return {
        id,
        queued: remaining !== null,
        failed,
        reportId: outcome?.reportId ?? null,
        message:
          outcome?.message ??
          (remaining !== null
            ? 'Saved on this device. It will send automatically when online.'
            : 'Report sent.'),
      }
    },
    [user, refresh],
  )

  const retry = useCallback(
    async (id: string) => {
      if (user === null) {
        return
      }

      await updateQueueItem(id, {
        status: 'queued',
        nextAttemptAt: null,
        lastError: null,
      })
      await refresh()
      await syncQueue(user.id, { force: true })
    },
    [user, refresh],
  )

  const retryAll = useCallback(async () => {
    if (user === null) {
      return
    }

    const pending = await listQueue(user.id)

    for (const item of pending) {
      await updateQueueItem(item.id, {
        status: 'queued',
        nextAttemptAt: null,
        lastError: null,
      })
    }

    await refresh()
    await syncQueue(user.id, { force: true })
  }, [user, refresh])

  const clearDeviceData = useCallback(async () => {
    if (user === null) {
      return
    }

    await clearQueueForUser(user.id)
    await refresh()
  }, [user, refresh])

  const dismissOutcomes = useCallback(() => {
    clearSyncOutcomes()
  }, [])

  const value = useMemo<QueueContextValue>(() => {
    return {
      items: user === null ? [] : items,
      pendingCount: user === null ? 0 : items.length,
      online: syncState.online,
      running: syncState.running,
      authRequired: syncState.authRequired,
      authStale: syncState.authStale,
      storageAvailable,
      outcomes: syncState.outcomes,
      submitLevelReport,
      retry,
      retryAll,
      clearDeviceData,
      dismissOutcomes,
      refresh,
    }
  }, [
    user,
    items,
    syncState,
    storageAvailable,
    submitLevelReport,
    retry,
    retryAll,
    clearDeviceData,
    dismissOutcomes,
    refresh,
  ])

  return (
    <QueueContext.Provider value={value}>{children}</QueueContext.Provider>
  )
}
