import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useSyncExternalStore } from 'react'
import { useAuth } from './useAuth'
import { QueueContext } from './QueueContext'
import type {
  QueueContextValue,
  SubmitImpactReportInput,
  SubmitLevelReportInput,
} from './QueueContext'
import type { QueueItem, SubmitReportResult } from '../types/queue'
import {
  clearQueueForUser,
  countPendingItems,
  isQueueStorageAvailable,
  listQueue,
  removeQueueItem,
  requestPersistentStorage,
  subscribeToQueue,
  updateQueueItem,
} from '../lib/offlineQueue'
import { deliverQueuedItem, createDeliveryDeps } from '../lib/queueDelivery'
import {
  clearSyncOutcomes,
  getSyncState,
  restartQueueItemPatch,
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
  const [loaded, setLoaded] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)

  const refresh = useCallback(async () => {
    if (user === null) {
      setLoaded(false)
      return
    }

    try {
      setItems(await listQueue(user.id))
    } catch {
      setStorageAvailable(false)
      setItems([])
    } finally {
      setLoaded(true)
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
            await updateQueueItem(item.id, restartQueueItemPatch())
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

  const deliverItem = useCallback(
    async (
      item: QueueItem,
      replaceQueueId?: string,
    ): Promise<SubmitReportResult> => {
      return deliverQueuedItem(item, replaceQueueId, createDeliveryDeps())
    },
    [],
  )

  const submitLevelReport = useCallback(
    async (
      input: SubmitLevelReportInput,
    ): Promise<SubmitReportResult> => {
      if (user === null) {
        throw new Error('You are not signed in.')
      }

      const photoBytes = await input.photo.arrayBuffer()
      const id = newClientId()

      return deliverItem(
        {
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
        },
        input.replaceQueueId,
      )
    },
    [user, deliverItem],
  )

  const submitImpactReport = useCallback(
    async (
      input: SubmitImpactReportInput,
    ): Promise<SubmitReportResult> => {
      if (user === null) {
        throw new Error('You are not signed in.')
      }

      const id = newClientId()

      // Impact reports carry no photo, so the record counts no bytes against
      // the offline budget.
      return deliverItem(
        {
          id,
          userId: user.id,
          kind: 'impact',
          payload: input.payload,
          status: 'queued',
          attempts: 0,
          lastError: null,
          nextAttemptAt: null,
          createdAt: Date.now(),
          observedAt: input.observedAt,
        },
        input.replaceQueueId,
      )
    },
    [user, deliverItem],
  )

  const retry = useCallback(
    async (id: string) => {
      if (user === null) {
        return
      }

      await updateQueueItem(id, restartQueueItemPatch())
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
      await updateQueueItem(item.id, restartQueueItemPatch())
    }

    await refresh()
    await syncQueue(user.id, { force: true })
  }, [user, refresh])

  const discard = useCallback(
    async (id: string) => {
      await removeQueueItem(id)
      await refresh()
    },
    [refresh],
  )

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
      loaded: user === null || loaded,
      pendingCount: user === null ? 0 : countPendingItems(items),
      online: syncState.online,
      running: syncState.running,
      authRequired: syncState.authRequired,
      authStale: syncState.authStale,
      storageAvailable,
      outcomes: syncState.outcomes,
      submitLevelReport,
      submitImpactReport,
      retry,
      retryAll,
      discard,
      clearDeviceData,
      dismissOutcomes,
      refresh,
    }
  }, [
    user,
    items,
    loaded,
    syncState,
    storageAvailable,
    submitLevelReport,
    submitImpactReport,
    retry,
    retryAll,
    discard,
    clearDeviceData,
    dismissOutcomes,
    refresh,
  ])

  return (
    <QueueContext.Provider value={value}>{children}</QueueContext.Provider>
  )
}
