import { useEffect, useState } from 'react'
import { describeFreshness } from '../lib/feedFreshness'

const CLOCK_TICK_MS = 1000

const STATE_BADGE = {
  pending: 'Substitute',
  fresh: 'Substitute',
  stale: 'Stale',
  live: 'Live',
} as const

export function FreshnessBar({
  lastSuccessAt,
  live = false,
  onRefresh,
}: {
  lastSuccessAt: number | null
  live?: boolean
  onRefresh: () => void
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)

    return () => window.clearInterval(handle)
  }, [])

  const freshness = describeFreshness(lastSuccessAt, now, { live })

  return (
    <div className={`feed-freshness is-${freshness.state}`}>
      <span className="freshness-badge">{STATE_BADGE[freshness.state]}</span>
      <span className="freshness-age">{freshness.label}</span>
      <button type="button" className="freshness-refresh" onClick={onRefresh}>
        Refresh now
      </button>
      <span className="freshness-note">{freshness.note}</span>
    </div>
  )
}
