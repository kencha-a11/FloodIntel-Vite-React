import { useCallback, useEffect, useState } from 'react'
import { getStoredToken } from '../lib/http'
import * as impactApi from '../lib/impactApi'
import type { FloodImpactReport } from '../types/impact'
import { BarangayImpactStatusView } from './BarangayImpactStatusView'
import { FloodImpactReportForm } from './FloodImpactReportForm'

export function ImpactReportsView({ canFileImpact }: { canFileImpact: boolean }) {
  const [token] = useState(getStoredToken)
  const [reports, setReports] = useState<FloodImpactReport[]>([])
  const [loaded, setLoaded] = useState(token === null)
  const [error, setError] = useState<string | null>(
    token === null ? 'Sign in again to load the barangay impact reports.' : null,
  )
  const [reloadKey, setReloadKey] = useState(0)

  const refresh = useCallback((): void => {
    setReloadKey((value) => value + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      if (token === null) {
        return
      }

      try {
        const next = await impactApi.listImpactReports(token)

        if (cancelled) {
          return
        }

        setReports(next)
        setError(null)
      } catch (err) {
        if (cancelled) {
          return
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load the barangay impact reports.',
        )
      } finally {
        if (!cancelled) {
          setLoaded(true)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [token, reloadKey])

  return (
    <>
      {canFileImpact && (
        <FloodImpactReportForm reports={reports} onFiled={refresh} />
      )}
      <BarangayImpactStatusView
        reports={loaded ? reports : null}
        error={error}
      />
    </>
  )
}
