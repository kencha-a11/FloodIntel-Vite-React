import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { AuthApiError, getStoredToken } from '../lib/authApi'
import { NOT_RECORDED, formatInstantWithAge } from '../lib/dateTime'
import { FLOOD_LEVELS } from '../lib/floodLevels'
import * as reportApi from '../lib/reportApi'
import {
  ALERT_LEVEL_ORDER,
  LEGACY_DEPTH_LABEL,
  REPORT_STATUSES,
  alertTierLabel,
  alertTierTone,
  floodLevelLabel,
  legacyDepthLevel,
  reportStatusLabel,
  reportStatusTone,
} from '../lib/vocabulary'
import { reportRealtimeLatency } from '../lib/realtimeApi'
import { feedPollEnabled } from '../lib/feedPoll'
import {
  downloadBlob,
  exportNoticeText,
  exportReportCsv,
  reportExportFilename,
} from '../lib/reportExport'
import { useFeedPoll } from '../lib/useFeedPoll'
import { useRealtimeFeed } from '../lib/useRealtimeFeed'
import { DeadlineBar } from './DeadlineBar'
import { FreshnessBar } from './FreshnessBar'
import { RealtimeLatencySummary } from './RealtimeLatencySummary'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Select,
  Spinner,
  TextInput,
} from './ui'
import type { RealtimeUpdate } from '../types/realtime'
import type {
  AlertLevel,
  Barangay,
  FloodLevel,
  FloodReport,
  FloodReportStatus,
  ReportFilters,
} from '../types/report'

const EMPTY_FILTERS: ReportFilters = {
  q: '',
  flood_level: '',
  alert_level: '',
  status: '',
  barangay_id: '',
  from: '',
  to: '',
  per_page: 15,
  page: 1,
}

function startOfDay(value: string): string {
  return value === '' ? '' : `${value}T00:00:00`
}

function endOfDay(value: string): string {
  return value === '' ? '' : `${value}T23:59:59`
}

function InstantRow({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  return (
    <p className="report-row-meta">
      {label}{' '}
      {value === null ? (
        NOT_RECORDED
      ) : (
        <time dateTime={value}>{formatInstantWithAge(value)}</time>
      )}
    </p>
  )
}

export function ReportList({
  canFilter,
  selectedReportId,
  onSelect,
}: {
  canFilter: boolean
  selectedReportId: number | null
  onSelect: (reportId: number) => void
}) {
  const { logout } = useAuth()
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS)
  const [reports, setReports] = useState<FloodReport[] | null>(null)
  const [barangays, setBarangays] = useState<Barangay[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportNotice, setExportNotice] = useState('')
  const [exportError, setExportError] = useState<string | null>(null)
  const [latencyRefreshKey, setLatencyRefreshKey] = useState(0)
  const pendingLatency = useRef<
    Array<{ reportId: number; event: string }>
  >([])
  const refreshRef = useRef<() => void>(() => {})

  const load = useCallback(
    async (signal: AbortSignal) => {
      const token = getStoredToken()

      if (token === null) {
        return
      }

      try {
        const response = await reportApi.listReports(token, {
          ...filters,
          from: startOfDay(filters.from),
          to: endOfDay(filters.to),
        })

        if (signal.aborted) {
          return
        }

        setReports(response.data)
        setCurrentPage(response.meta.current_page)
        setLastPage(response.meta.last_page)
        setTotal(response.meta.total)
        setError(null)

        const applied = pendingLatency.current
        pendingLatency.current = []

        if (applied.length > 0) {
          const appliedAt = new Date().toISOString()

          for (const sample of applied) {
            void reportRealtimeLatency(token, {
              ...sample,
              appliedAt,
            }).catch(() => {})
          }

          setLatencyRefreshKey((value) => value + 1)
        }
      } catch (err) {
        if (signal.aborted) {
          return
        }

        if (err instanceof AuthApiError && err.status === 401) {
          await logout()
          throw err
        }

        pendingLatency.current = []
        setError(
          err instanceof AuthApiError
            ? err.message
            : 'Unable to connect to the server.',
        )
        throw err
      }
    },
    [filters, logout],
  )

  const handleRealtimeUpdate = useCallback((update: RealtimeUpdate) => {
    pendingLatency.current.push({
      reportId: update.reportId,
      event: update.event,
    })
    refreshRef.current()
  }, [])

  const { status: realtimeStatus } = useRealtimeFeed(handleRealtimeUpdate)
  const { lastSuccessAt, refresh } = useFeedPoll(load, {
    enabled: feedPollEnabled(realtimeStatus),
  })

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  const isLoading = reports === null && error === null

  useEffect(() => {
    let cancelled = false

    async function loadBarangays() {
      if (!canFilter) {
        return
      }

      const token = getStoredToken()

      if (token === null) {
        return
      }

      try {
        const response = await reportApi.listBarangays(token)

        if (!cancelled) {
          setBarangays(response)
        }
      } catch {
        setBarangays([])
      }
    }

    void loadBarangays()

    return () => {
      cancelled = true
    }
  }, [canFilter])

  function updateFilter(
    key: keyof ReportFilters,
    value: string,
  ): void {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }

  function goToPage(page: number): void {
    setFilters((current) => ({ ...current, page }))
  }

  async function handleExport(): Promise<void> {
    const token = getStoredToken()

    if (token === null) {
      return
    }

    setExporting(true)
    setExportError(null)

    try {
      const result = await exportReportCsv(token, {
        ...filters,
        from: startOfDay(filters.from),
        to: endOfDay(filters.to),
      })

      downloadBlob(result.blob, reportExportFilename(filters))
      setExportNotice(exportNoticeText(filters, result.count))
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 401) {
        await logout()
        return
      }

      setExportError(
        err instanceof AuthApiError
          ? err.message
          : 'Unable to export the report log.',
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="report-list">
      <h2>{canFilter ? 'Flood report queue' : 'Flood reports'}</h2>

      {canFilter && <DeadlineBar />}

      <FreshnessBar
        lastSuccessAt={lastSuccessAt}
        live={realtimeStatus === 'live'}
        onRefresh={refresh}
      />

      {canFilter && <RealtimeLatencySummary refreshKey={latencyRefreshKey} />}

      {error && <Alert tone="danger">{error}</Alert>}
      {exportError && <Alert tone="danger">{exportError}</Alert>}

      <div className="filter-bar">
        <Field
          id="filter-q"
          label="Search"
          hint="Matches notes, landmark, address, or reporter name."
        >
          <TextInput
            type="search"
            value={filters.q}
            onChange={(event) => updateFilter('q', event.target.value)}
          />
        </Field>

        <Field id="filter-status" label="Status">
          <Select
            value={filters.status}
            onChange={(event) =>
              updateFilter('status', event.target.value as FloodReportStatus | '')
            }
          >
            <option value="">All statuses</option>
            {REPORT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {reportStatusLabel(status)}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="filter-alert" label="Alert level">
          <Select
            value={filters.alert_level}
            onChange={(event) =>
              updateFilter('alert_level', event.target.value as AlertLevel | '')
            }
          >
            <option value="">All alert levels</option>
            {ALERT_LEVEL_ORDER.map((level) => (
              <option key={level} value={level}>
                {alertTierLabel(level)}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="filter-level" label={LEGACY_DEPTH_LABEL}>
          <Select
            value={filters.flood_level}
            onChange={(event) =>
              updateFilter(
                'flood_level',
                event.target.value as FloodLevel | '',
              )
            }
          >
            <option value="">All depths</option>
            {FLOOD_LEVELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        {canFilter && (
          <Field id="filter-barangay" label="Barangay">
            <Select
              value={filters.barangay_id}
              onChange={(event) => updateFilter('barangay_id', event.target.value)}
            >
              <option value="">All barangays</option>
              {barangays.map((barangay) => (
                <option key={barangay.id} value={barangay.id}>
                  {barangay.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field id="filter-from" label="From">
          <TextInput
            type="date"
            value={filters.from}
            onChange={(event) => updateFilter('from', event.target.value)}
          />
        </Field>

        <Field id="filter-to" label="To">
          <TextInput
            type="date"
            value={filters.to}
            onChange={(event) => updateFilter('to', event.target.value)}
          />
        </Field>
      </div>

      {canFilter && (
        <div className="report-export">
          <Button
            variant="secondary"
            size="compact"
            disabled={exporting}
            aria-busy={exporting}
            onClick={() => void handleExport()}
          >
            {exporting ? 'Preparing CSV…' : 'Export CSV'}
          </Button>
          <span className="muted" role="status">
            {exportNotice}
          </span>
        </div>
      )}

      {isLoading ? (
        <Spinner label="Loading reports…" />
      ) : reports === null ? null : reports.length === 0 ? (
        <EmptyState title="No reports found." />
      ) : (
        <ul className="report-items">
          {reports.map((report) => (
            <li key={report.id}>
              <button
                type="button"
                className={
                  report.id === selectedReportId
                    ? 'report-row report-row-selected'
                    : 'report-row'
                }
                aria-current={report.id === selectedReportId ? 'true' : undefined}
                onClick={() => onSelect(report.id)}
              >
                <img
                  className="report-thumb"
                  src={report.photo_url}
                  alt={`Flood photo for report ${report.id}`}
                  loading="lazy"
                />
                <div className="report-row-body">
                  <div className="report-row-header">
                    {report.alert_level !== null ? (
                      <Badge tone={alertTierTone(report.alert_level)}>
                        {alertTierLabel(report.alert_level)}
                      </Badge>
                    ) : (
                      <Badge severity={legacyDepthLevel(report.severity) ?? undefined}>
                        Legacy depth: {floodLevelLabel(report.flood_level) ?? 'not recorded'}
                      </Badge>
                    )}
                    <Badge tone={reportStatusTone(report.status)}>
                      {reportStatusLabel(report.status)}
                    </Badge>
                    {report.anomaly_flags.map((flag) => (
                      <span key={flag.value} className="anomaly-badge">
                        Flag: {flag.label}
                      </span>
                    ))}
                  </div>
                  <p className="report-row-meta">
                    {report.barangay.name} · {report.user.first_name}{' '}
                    {report.user.last_name}
                  </p>
                  <InstantRow label="Observed" value={report.reported_at} />
                  <InstantRow label="Received" value={report.created_at} />
                  {report.notes !== null && report.notes !== '' && (
                    <p className="report-row-notes">{report.notes}</p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {total > 0 && (
        <div className="pagination">
          <Button
            variant="secondary"
            size="compact"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => goToPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="muted">
            Page {currentPage} of {lastPage} · {total} reports
          </span>
          <Button
            variant="secondary"
            size="compact"
            disabled={currentPage >= lastPage || isLoading}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
