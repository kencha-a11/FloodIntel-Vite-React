import { useEffect, useState } from 'react'
import { getStoredToken } from '../lib/http'
import { fetchLatencySummary } from '../lib/realtimeApi'
import { describeLatencySummary } from '../lib/realtimeLatency'
import type { RealtimeLatencySummary as Summary } from '../types/realtime'

export function RealtimeLatencySummary({ refreshKey }: { refreshKey: number }) {
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    let cancelled = false
    const token = getStoredToken()

    if (token === null) {
      return
    }

    fetchLatencySummary(token)
      .then((value) => {
        if (!cancelled) {
          setSummary(value)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (summary === null || summary.samples === 0) {
    return null
  }

  return <p className="realtime-latency">{describeLatencySummary(summary)}</p>
}
