import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/useAuth'
import { AuthApiError, getStoredToken } from '../lib/authApi'
import * as reportApi from '../lib/reportApi'
import type { FieldErrors } from '../types/auth'
import type { FloodReport } from '../types/report'

const REJECT_MANAGE_USERS = 'manage-users'

export function ReportDetail({
  reportId,
  onBack,
}: {
  reportId: number
  onBack: () => void
}) {
  const { user, logout } = useAuth()
  const [report, setReport] = useState<FloodReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionError, setRejectionError] = useState<string | null>(null)
  const [serverFieldErrors, setServerFieldErrors] = useState<FieldErrors>({})
  const [isRejecting, setIsRejecting] = useState(false)

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
        const response = await reportApi.getReport(token, reportId)

        if (!cancelled) {
          setReport(response)
        }
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
  }, [reportId, logout])

  async function handleReject(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    const token = getStoredToken()

    if (token === null || isRejecting) {
      return
    }

    if (rejectionReason.trim() === '') {
      setRejectionError('A reason is required to reject a report.')
      return
    }

    setIsRejecting(true)
    setRejectionError(null)
    setServerFieldErrors({})

    try {
      const response = await reportApi.rejectReport(
        token,
        reportId,
        rejectionReason.trim(),
      )

      setReport(response)
      setRejectionReason('')
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.status === 401) {
          await logout()
          return
        }

        setRejectionError(err.message)
        setServerFieldErrors(err.errors)
      } else {
        setRejectionError('Unable to connect to the server.')
      }
    } finally {
      setIsRejecting(false)
    }
  }

  const canReject =
    (user?.abilities ?? []).includes(REJECT_MANAGE_USERS) &&
    report !== null &&
    report.status === 'submitted'

  return (
    <div className="report-detail">
      <div className="report-detail-header">
        <h2>Report #{reportId}</h2>
        <button type="button" className="counter" onClick={onBack}>
          Back
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="muted">Loading report…</p>
      ) : report === null ? (
        <p className="muted">Report not found.</p>
      ) : (
        <>
          {report.photo_url !== '' && (
            <img
              className="photo-preview"
              src={report.photo_url}
              alt={`Flood photo for report ${report.id}`}
            />
          )}

          <dl className="report-summary">
            <div>
              <dt>Flood level</dt>
              <dd>
                <span
                  className={`severity-badge severity-${report.severity}`}
                >
                  {report.flood_level_label}
                </span>{' '}
                <span className={`status-badge status-${report.status}`}>
                  {report.status}
                </span>
              </dd>
            </div>
            <div>
              <dt>Barangay</dt>
              <dd>{report.barangay.name}</dd>
            </div>
            <div>
              <dt>Reported by</dt>
              <dd>
                {report.user.first_name} {report.user.last_name}
              </dd>
            </div>
            <div>
              <dt>Coordinates</dt>
              <dd>
                {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                {report.gps_accuracy !== null && (
                  <span className="muted">
                    {' '}
                    (±{Math.round(report.gps_accuracy)} m accuracy)
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>Observed at</dt>
              <dd>{new Date(report.reported_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{report.notes ?? 'None'}</dd>
            </div>
            {report.status === 'rejected' && (
              <div>
                <dt>Rejection reason</dt>
                <dd>{report.rejection_reason ?? 'None'}</dd>
              </div>
            )}
          </dl>

          {canReject && (
            <form className="auth-form" onSubmit={(event) => void handleReject(event)} noValidate>
              <h3>Reject this report</h3>

              {rejectionError && (
                <p className="form-error" role="alert">
                  {rejectionError}
                </p>
              )}

              <label className="field">
                <span>Reason</span>
                <textarea
                  value={rejectionReason}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => setRejectionReason(event.target.value)}
                />
                {serverFieldErrors.rejection_reason?.[0] && (
                  <small className="field-error">
                    {serverFieldErrors.rejection_reason[0]}
                  </small>
                )}
              </label>

              <button type="submit" disabled={isRejecting}>
                {isRejecting ? 'Rejecting…' : 'Reject report'}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  )
}
