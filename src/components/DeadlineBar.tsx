import { useEffect, useState } from 'react'
import {
  cacheDeadlines,
  describeAsOf,
  describeBasis,
  fetchDeadlines,
  formatCountdown,
  readCachedDeadlines,
  remainingSeconds,
} from '../lib/deadlines'
import type { DeadlinesPayload } from '../lib/deadlines'
import { getStoredToken } from '../lib/http'
import { Alert } from './ui'

const REFRESH_INTERVAL_MS = 60_000

interface DeadlineSnapshot {
  payload: DeadlinesPayload
  fetchedAt: number
  stale: boolean
}

export function DeadlineBar() {
  const [snapshot, setSnapshot] = useState<DeadlineSnapshot | null>(null)
  const [failed, setFailed] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const hasSnapshot = snapshot !== null

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      const token = getStoredToken()

      if (token === null) {
        return
      }

      try {
        const payload = await fetchDeadlines(token)

        if (cancelled) {
          return
        }

        const fetchedAt = Date.now()
        cacheDeadlines(payload, fetchedAt)
        setSnapshot({ payload, fetchedAt, stale: false })
        setElapsed(0)
        setFailed(false)
      } catch {
        if (cancelled) {
          return
        }

        const cached = readCachedDeadlines()
        setFailed(true)

        if (cached !== null) {
          setSnapshot({
            payload: cached.payload,
            fetchedAt: cached.fetchedAt,
            stale: true,
          })
          setElapsed(
            Math.max(0, Math.round((Date.now() - cached.fetchedAt) / 1000)),
          )
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setReloadKey((value) => value + 1)
    }, REFRESH_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!hasSnapshot) {
      return
    }

    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [hasSnapshot])

  if (snapshot === null) {
    return failed ? (
      <Alert tone="warning">
        Deadline status is unavailable while offline. Pending counts are
        unknown, not zero.
      </Alert>
    ) : null
  }

  const { payload } = snapshot
  const remaining = remainingSeconds(
    payload.window.next_cutoff_at,
    payload.now,
    elapsed,
  )

  return (
    <section className="deadline-bar" aria-label="Consolidation deadlines">
      <p className="deadline-bar-countdown">
        {remaining > 0
          ? `Next consolidation cutoff in ${formatCountdown(remaining)}`
          : 'Consolidation cutoff reached — refreshing the window.'}
      </p>
      <p className="deadline-bar-meta">
        Window {payload.window.label} ({payload.timezone}) ·{' '}
        {payload.pending.total} pending · as of {describeAsOf(snapshot.fetchedAt)}
        {snapshot.stale ? ' · last known value while offline' : ''}
      </p>
      <p className="deadline-bar-meta">
        {describeBasis(payload.pending.basis)}
      </p>
      <ul className="deadline-bar-list">
        {payload.pending.by_barangay.map((row) => (
          <li
            key={row.barangay_id}
            className={
              row.pending === 0
                ? 'deadline-bar-item'
                : 'deadline-bar-item is-pending'
            }
          >
            <span>{row.barangay}</span>
            <span className="deadline-bar-count">{row.pending}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
