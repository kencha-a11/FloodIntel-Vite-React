import { useCallback, useEffect, useState } from 'react'
import type { AccessTagTypeOption } from '../types/accessTag'
import { listAccessTagTypes, readCachedAccessTagTypes } from './accessTagTypes'
import { getStoredToken } from './http'

/*
 * The optional tag step needs the server's vocabulary before it can offer a
 * choice (FR-112, NFR-42). A device that loaded it once keeps working with no
 * connectivity; a device that never did says so and offers a retry rather than
 * inventing labels (FR-117, D-129).
 */

export type TagTypesStatus = 'loading' | 'ready' | 'unavailable'

export interface TagTypesState {
  options: AccessTagTypeOption[]
  status: TagTypesStatus
  reload: () => void
}

export function useAccessTagTypes(enabled: boolean): TagTypesState {
  const [options, setOptions] = useState<AccessTagTypeOption[]>([])
  const [status, setStatus] = useState<TagTypesStatus>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const cached = readCachedAccessTagTypes()

    if (cached !== null) {
      setOptions(cached)
      setStatus('ready')
    }

    const token = getStoredToken()

    if (token === null || !navigator.onLine) {
      if (cached === null) {
        setStatus('unavailable')
      }

      return
    }

    let cancelled = false

    listAccessTagTypes(token)
      .then((list) => {
        if (!cancelled) {
          setOptions(list)
          setStatus('ready')
        }
      })
      .catch(() => {
        // A stale list still labels the step; only an empty device is stuck.
        if (!cancelled) {
          setStatus(cached === null ? 'unavailable' : 'ready')
        }
      })

    return () => {
      cancelled = true
    }
  }, [enabled, attempt])

  useEffect(() => {
    if (!enabled || status !== 'unavailable') {
      return
    }

    function handleOnline(): void {
      setAttempt((count) => count + 1)
    }

    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [enabled, status])

  const reload = useCallback(() => {
    setStatus('loading')
    setAttempt((count) => count + 1)
  }, [])

  return { options, status, reload }
}
