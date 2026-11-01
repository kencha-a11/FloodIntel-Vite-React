import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/useAuth'
import { AuthApiError, getStoredToken } from '../lib/authApi'
import * as reportApi from '../lib/reportApi'
import {
  availableReportActions,
  overrideTargets,
} from '../lib/reportActions'
import type { OverrideTarget } from '../lib/reportActions'
import {
  LEGACY_DEPTH_LABEL,
  LEGACY_DEPTH_NOTE,
  alertTierLabel,
  alertTierTone,
  floodLevelLabel,
  legacyDepthLevel,
  reportStatusLabel,
  reportStatusTone,
} from '../lib/vocabulary'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Select,
  Spinner,
  Textarea,
} from './ui'
import type { FieldErrors } from '../types/auth'
import type { FloodReport } from '../types/report'

function combineErrors(
  ...messages: (string | null | undefined)[]
): string | undefined {
  const present = messages.filter(
    (message): message is string => message !== null && message !== undefined && message !== '',
  )

  return present.length === 0 ? undefined : present.join(' ')
}

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
  const [returnReason, setReturnReason] = useState('')
  const [returnError, setReturnError] = useState<string | null>(null)
  const [overrideTarget, setOverrideTarget] = useState<OverrideTarget | ''>('')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [serverFieldErrors, setServerFieldErrors] = useState<FieldErrors>({})
  const [isRejecting, setIsRejecting] = useState(false)
  const [isActing, setIsActing] = useState(false)

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

  async function runDecision(
    action: (token: string) => Promise<FloodReport>,
  ): Promise<boolean> {
    const token = getStoredToken()

    if (token === null || isActing) {
      return false
    }

    setIsActing(true)
    setActionError(null)
    setServerFieldErrors({})

    try {
      setReport(await action(token))
      return true
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.status === 401) {
          await logout()
          return false
        }

        setActionError(err.message)
        setServerFieldErrors(err.errors)
      } else {
        setActionError('Unable to connect to the server.')
      }

      return false
    } finally {
      setIsActing(false)
    }
  }

  async function handleValidate(): Promise<void> {
    if (
      !window.confirm(
        `Validate report #${reportId}? Validated reports are the only ones the heatmap and situational reports use.`,
      )
    ) {
      return
    }

    const ok = await runDecision((token) =>
      reportApi.validateReport(token, reportId),
    )

    if (ok) {
      setActionError(null)
    }
  }

  async function handleReturn(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    if (returnReason.trim() === '') {
      setReturnError('A reason is required to return a report.')
      return
    }

    if (
      !window.confirm(
        `Return report #${reportId} for correction? The reporter will see your reason.`,
      )
    ) {
      return
    }

    setReturnError(null)

    const ok = await runDecision((token) =>
      reportApi.returnReport(token, reportId, returnReason.trim()),
    )

    if (ok) {
      setReturnReason('')
    }
  }

  async function handleOverride(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()

    if (overrideTarget === '') {
      setOverrideError('Choose the status to override to.')
      return
    }

    if (overrideReason.trim() === '') {
      setOverrideError('A reason is required to override a decision.')
      return
    }

    const target = overrideTarget
    const current = report === null ? 'decided' : reportStatusLabel(report.status).toLowerCase()

    if (
      !window.confirm(
        `Override this ${current} report to ${reportStatusLabel(target)}? The change is recorded in the audit log.`,
      )
    ) {
      return
    }

    setOverrideError(null)

    const ok = await runDecision((token) =>
      reportApi.overrideReport(token, reportId, target, overrideReason.trim()),
    )

    if (ok) {
      setOverrideReason('')
      setOverrideTarget('')
    }
  }

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

  const actions =
    report === null
      ? null
      : availableReportActions(report, user?.abilities ?? [], user?.role)

  const targets = report === null ? [] : overrideTargets(report.status)

  return (
    <div className="report-detail">
      <div className="report-detail-header">
        <h2>Report #{reportId}</h2>
        <Button variant="secondary" size="compact" onClick={onBack}>
          Back
        </Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <Spinner label="Loading report…" />
      ) : report === null ? (
        <EmptyState title="Report not found." />
      ) : (
        <>
          {report.photo_url !== '' && (
            <img
              className="photo-preview"
              src={report.photo_url}
              alt={`Flood photo for report ${report.id}`}
            />
          )}

          {report.anomaly_flags.length > 0 && (
            <Card className="anomaly-panel" label="Report anomaly flags">
              <h3>Flags for review</h3>
              <p className="muted">
                Flags are review aids. They do not change the report's status.
              </p>
              <ul className="anomaly-list">
                {report.anomaly_flags.map((flag) => (
                  <li key={flag.value}>{flag.label}</li>
                ))}
              </ul>
            </Card>
          )}

          <dl className="report-summary">
            <div>
              <dt>Alert level</dt>
              <dd>
                {report.alert_level !== null ? (
                  <Badge tone={alertTierTone(report.alert_level)}>
                    {alertTierLabel(report.alert_level)}
                  </Badge>
                ) : (
                  'Not recorded'
                )}{' '}
                <Badge tone={reportStatusTone(report.status)}>
                  {reportStatusLabel(report.status)}
                </Badge>
              </dd>
            </div>
            <div>
              <dt>{LEGACY_DEPTH_LABEL}</dt>
              <dd>
                <Badge severity={legacyDepthLevel(report.severity) ?? undefined}>
                  {floodLevelLabel(report.flood_level) ?? 'Not recorded'}
                </Badge>{' '}
                <span className="muted">{LEGACY_DEPTH_NOTE}</span>
              </dd>
            </div>
            <div>
              <dt>Flood type</dt>
              <dd>{report.flood_type_label ?? '—'}</dd>
            </div>
            <div>
              <dt>Depth (cm)</dt>
              <dd>{report.depth_cm ?? '—'}</dd>
            </div>
            <div>
              <dt>Landmark</dt>
              <dd>{report.landmark ?? '—'}</dd>
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
              <dt>Address</dt>
              <dd className="report-address">
                {report.address ?? 'Not available'}
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

          {report.status_changes !== undefined &&
            report.status_changes.length > 0 && (
              <section
                className="status-history"
                aria-label="Status history"
              >
                <h3>Status history</h3>
                <ol className="status-history-list">
                  {report.status_changes.map((change) => (
                    <li key={change.id}>
                      <p>
                        <strong>{reportStatusLabel(change.to_status)}</strong>
                        {change.from_status !== null &&
                          ` from ${reportStatusLabel(change.from_status)}`}{' '}
                        · {change.actor_name}
                        {change.actor_role_label !== null &&
                          ` (${change.actor_role_label})`}
                      </p>
                      <p className="report-row-meta">
                        {new Date(change.created_at).toLocaleString()}
                        {change.reason !== null && ` — ${change.reason}`}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

          {actionError && <Alert tone="danger">{actionError}</Alert>}

          {actions !== null && (actions.canValidate || actions.canReturn) && (
            <section className="review-actions" aria-label="Validation actions">
              <h3>Validation decision</h3>

              {actions.canValidate && (
                <Button
                  disabled={isActing}
                  onClick={() => void handleValidate()}
                >
                  {isActing ? 'Validating…' : 'Validate report'}
                </Button>
              )}

              {actions.canReturn && (
                <form
                  className="ui-form"
                  onSubmit={(event) => void handleReturn(event)}
                  noValidate
                >
                  <h4>Return for correction</h4>

                  <Field
                    id="return-reason"
                    label="Reason (shown to the reporter)"
                    error={combineErrors(
                      returnError,
                      serverFieldErrors.return_reason?.[0],
                    )}
                  >
                    <Textarea
                      value={returnReason}
                      maxLength={500}
                      rows={3}
                      onChange={(event) => setReturnReason(event.target.value)}
                    />
                  </Field>

                  <Button type="submit" disabled={isActing}>
                    {isActing ? 'Returning…' : 'Return for correction'}
                  </Button>
                </form>
              )}
            </section>
          )}

          {actions?.canOverride && (
            <form
              className="ui-form"
              onSubmit={(event) => void handleOverride(event)}
              noValidate
            >
              <h3>Override the decision</h3>
              <p className="muted">
                Overriding records a new, reasoned entry in the status history;
                nothing is erased.
              </p>

              <Field
                id="override-target"
                label="New status"
                error={combineErrors(
                  overrideError,
                  serverFieldErrors.to_status?.[0],
                  serverFieldErrors.status?.[0],
                )}
              >
                <Select
                  value={overrideTarget}
                  onChange={(event) =>
                    setOverrideTarget(event.target.value as OverrideTarget | '')
                  }
                >
                  <option value="">Choose a status</option>
                  {targets.map((target) => (
                    <option key={target} value={target}>
                      {reportStatusLabel(target)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                id="override-reason"
                label="Reason"
                error={serverFieldErrors.reason?.[0]}
              >
                <Textarea
                  value={overrideReason}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => setOverrideReason(event.target.value)}
                />
              </Field>

              <Button type="submit" disabled={isActing}>
                {isActing ? 'Overriding…' : 'Override decision'}
              </Button>
            </form>
          )}

          {actions?.canReject && (
            <form
              className="ui-form"
              onSubmit={(event) => void handleReject(event)}
              noValidate
            >
              <h3>Reject this report</h3>

              {rejectionError && <Alert tone="danger">{rejectionError}</Alert>}

              <Field
                id="reject-reason"
                label="Reason"
                error={serverFieldErrors.rejection_reason?.[0]}
              >
                <Textarea
                  value={rejectionReason}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => setRejectionReason(event.target.value)}
                />
              </Field>

              <Button type="submit" variant="danger" disabled={isRejecting}>
                {isRejecting ? 'Rejecting…' : 'Reject report'}
              </Button>
            </form>
          )}
        </>
      )}
    </div>
  )
}
