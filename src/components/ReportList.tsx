import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { AuthApiError, getStoredToken } from '../lib/authApi'
import { FLOOD_LEVELS } from '../lib/floodLevels'
import * as reportApi from '../lib/reportApi'
import type {
  Barangay,
  FloodLevel,
  FloodReport,
  FloodReportStatus,
  ReportFilters,
} from '../types/report'

const EMPTY_FILTERS: ReportFilters = {
  flood_level: '',
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

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

export function ReportList({
  canFilter,
  onSelect,
}: {
  canFilter: boolean
  onSelect: (reportId: number) => void
}) {
  const { logout } = useAuth()
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS)
  const [reports, setReports] = useState<FloodReport[]>([])
  const [barangays, setBarangays] = useState<Barangay[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)

      const token = getStoredToken()

      if (token === null) {
        setIsLoading(false)
        return
      }

      try {
        const response = await reportApi.listReports(token, {
          ...filters,
          from: startOfDay(filters.from),
          to: endOfDay(filters.to),
        })

        if (cancelled) {
          return
        }

        setReports(response.data)
        setCurrentPage(response.meta.current_page)
        setLastPage(response.meta.last_page)
        setTotal(response.meta.total)
      } catch (err) {
        if (cancelled) {
          return
        }

        if (err instanceof AuthApiError) {
          if (err.status === 401) {
            await logout()
            return
          }

          setError(err.message)
        } else {
          setError('Unable to connect to the server.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [filters, logout])

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

  return (
    <div className="report-list">
      <h2>{canFilter ? 'Flood report queue' : 'Flood reports'}</h2>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="filter-bar">
        <label className="field">
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) =>
              updateFilter('status', event.target.value as FloodReportStatus | '')
            }
          >
            <option value="">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>

        <label className="field">
          <span>Level</span>
          <select
            value={filters.flood_level}
            onChange={(event) =>
              updateFilter(
                'flood_level',
                event.target.value as FloodLevel | '',
              )
            }
          >
            <option value="">All levels</option>
            {FLOOD_LEVELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {canFilter && (
          <label className="field">
            <span>Barangay</span>
            <select
              value={filters.barangay_id}
              onChange={(event) => updateFilter('barangay_id', event.target.value)}
            >
              <option value="">All barangays</option>
              {barangays.map((barangay) => (
                <option key={barangay.id} value={barangay.id}>
                  {barangay.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="field">
          <span>From</span>
          <input
            type="date"
            value={filters.from}
            onChange={(event) => updateFilter('from', event.target.value)}
          />
        </label>

        <label className="field">
          <span>To</span>
          <input
            type="date"
            value={filters.to}
            onChange={(event) => updateFilter('to', event.target.value)}
          />
        </label>
      </div>

      {isLoading ? (
        <p className="muted">Loading reports…</p>
      ) : reports.length === 0 ? (
        <p className="muted">No reports found.</p>
      ) : (
        <ul className="report-items">
          {reports.map((report) => (
            <li key={report.id}>
              <button
                type="button"
                className="report-row"
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
                    <span className={`severity-badge severity-${report.severity}`}>
                      {report.flood_level_label}
                    </span>
                    <span
                      className={`status-badge status-${report.status}`}
                    >
                      {report.status}
                    </span>
                  </div>
                  <p className="report-row-meta">
                    {report.barangay.name} · {report.user.first_name}{' '}
                    {report.user.last_name}
                  </p>
                  <p className="report-row-meta">
                    Observed {formatDateTime(report.reported_at)}
                  </p>
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
          <button
            type="button"
            className="counter"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => goToPage(currentPage - 1)}
          >
            Previous
          </button>
          <span className="muted">
            Page {currentPage} of {lastPage} · {total} reports
          </span>
          <button
            type="button"
            className="counter"
            disabled={currentPage >= lastPage || isLoading}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
