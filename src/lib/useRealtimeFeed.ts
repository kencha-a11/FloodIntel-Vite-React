import { useEffect, useRef, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getStoredToken } from './http'
import { fetchRealtimeAuthorization } from './realtimeApi'
import { authRefreshDelayMs } from './realtimeFeed'
import {
  openRealtimeSubscription,
  type RealtimeClientLike,
} from './realtimeSubscription'
import type { RealtimeUpdate } from '../types/realtime'

export type RealtimeFeedStatus = 'connecting' | 'live' | 'disabled' | 'failed'

export function useRealtimeFeed(
  onUpdate: (update: RealtimeUpdate) => void,
): { status: RealtimeFeedStatus } {
  const [status, setStatus] = useState<RealtimeFeedStatus>(() =>
    getStoredToken() === null ? 'disabled' : 'connecting',
  )
  const updateRef = useRef(onUpdate)

  useEffect(() => {
    updateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    let cancelled = false
    let client: SupabaseClient | null = null
    let subscription: { close(): void } | null = null
    let timer: number | null = null

    function schedule(expiresAt: string | null): void {
      if (timer !== null) {
        window.clearTimeout(timer)
      }

      timer = window.setTimeout(() => {
        void renew()
      }, authRefreshDelayMs(expiresAt, Date.now()))
    }

    function fail(): void {
      subscription?.close()
      subscription = null
      setStatus('failed')
    }

    async function renew(): Promise<void> {
      if (cancelled) {
        return
      }

      const token = getStoredToken()

      if (token === null) {
        setStatus('disabled')
        return
      }

      try {
        const authorization = await fetchRealtimeAuthorization(token)

        if (cancelled) {
          return
        }

        if (!authorization.enabled || authorization.token === null) {
          fail()
          return
        }

        client?.realtime.setAuth(authorization.token)
        schedule(authorization.expiresAt)
      } catch {
        if (!cancelled) {
          fail()
        }
      }
    }

    async function connect(): Promise<void> {
      const token = getStoredToken()

      if (token === null) {
        setStatus('disabled')
        return
      }

      try {
        const authorization = await fetchRealtimeAuthorization(token)

        if (cancelled) {
          return
        }

        if (
          !authorization.enabled ||
          authorization.url === null ||
          authorization.anonKey === null ||
          authorization.token === null
        ) {
          setStatus('disabled')
          return
        }

        client = createClient(authorization.url, authorization.anonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        })
        client.realtime.setAuth(authorization.token)
        subscription = openRealtimeSubscription(
          client as unknown as RealtimeClientLike,
          authorization.topics,
          (update) => updateRef.current(update),
          (next) => {
            if (!cancelled) {
              setStatus(next)
            }
          },
        )
        schedule(authorization.expiresAt)
      } catch {
        if (!cancelled) {
          setStatus('failed')
        }
      }
    }

    void connect()

    return () => {
      cancelled = true

      if (timer !== null) {
        window.clearTimeout(timer)
      }

      subscription?.close()

      if (client !== null) {
        void client.removeAllChannels()
      }
    }
  }, [])

  return { status }
}
