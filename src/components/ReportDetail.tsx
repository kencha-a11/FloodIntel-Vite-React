import { lazy, Suspense, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/useAuth'
import { AuthApiError, getStoredToken } from '../lib/authApi'
import { NOT_RECORDED, formatInstantWithAge } from '../lib/dateTime'
import { userPermissions } from '../lib/permissions'
import * as reportApi from '../lib/reportApi'
import {
  DECISION_CANCEL_LABEL,
  decisionCopy,
} from '../lib/reviewDecision'
import type { ReviewDecision } from '../lib/reviewDecision'
import {
  availableReportActions,
  canFileCorrection,
  overrideTargets,
} from '../lib/reportActions'
import type { OverrideTarget } from '../lib/reportActions'
import {
  LEGACY_DEPTH_LABEL,
  LEGACY_DEPTH_NOTE,
  alertTierLabel,
  alertTierTone,
  correctionLinkLabel,
  floodLevelLabel,
  legacyDepthLevel,
  reportStatusLabel,
  reportStatusTone,
  supersededByLabel,
} from '../lib/vocabulary'
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Select,
  Spinner,
  Textarea,
} from './ui'
import type { FieldErrors } from '../types/auth'
import type { FloodReport } from '../types/report'

// The location map is its own chunk: a reviewer who never opens a report never
// downloads MapLibre.
const ReportLocationMap = lazy(() => import('./ReportLocationMap'))

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
  onSelect,
  onCorrect,
}: {
  reportId: number
  onBack: () => void
  onSelect: (reportId: number) => void
  onCorrect: (reportId: number) => void
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
  const [pendingDecision, setPendingDecision] = useState<ReviewDecision | null>(
    null,
  )
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

  function closeDecision(): void {
    if (isActing) {
      return
    }

    setPendingDecision(null)
  }

  async function confirmDecision(): Promise<void> {
    const decision = pendingDecision

    if (decision === null) {
      return
    }

    const ok = await runDecision((token) => {
      switch (decision.kind) {
        case 'validate':
          return reportApi.validateReport(token, decision.reportId)
        case 'return':
          return reportApi.returnReport(token, decision.reportId, decision.reason)
        case 'reject':
          return reportApi.rejectReport(token, decision.reportId, decision.reason)
        case 'override':
          return reportApi.overrideReport(
            token,
            decision.reportId,
            decision.target,
            decision.reason,
          )
      }
    })

    setPendingDecision(null)

    if (!ok) {
      return
    }

    if (decision.kind === 'return') {
      setReturnReason('')
      setReturnError(null)
    }

    if (decision.kind === 'reject') {
      setRejectionReason('')
      setRejectionError(null)
    }

    if (decision.kind === 'override') {
      setOverrideReason('')
      setOverrideTarget('')
      setOverrideError(null)
    }
  }

  function handleValidate(): void {
    setActionError(null)
    setPendingDecision({ kind: 'validate', reportId })
  }

  function handleReturn(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (returnReason.trim() === '') {
      setReturnError('A reason is required to return a report.')
      return
    }

    setReturnError(null)
    setActionError(null)
    setPendingDecision({
      kind: 'return',
      reportId,
      reason: returnReason.trim(),
    })
  }

  function handleOverride(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (overrideTarget === '') {
      setOverrideError('Choose the status to override to.')
      return
    }

    if (overrideReason.trim() === '') {
      setOverrideError('A reason is required to override a decision.')
      return
    }

    if (report === null) {
      return
    }

    setOverrideError(null)
    setActionError(null)
    setPendingDecision({
      kind: 'override',
      reportId,
      from: report.status,
      target: overrideTarget,
      reason: overrideReason.trim(),
    })
  }

  function handleReject(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (rejectionReason.trim() === '') {
      setRejectionError('A reason is required to reject a report.')
      return
    }

    setRejectionError(null)
    setActionError(null)
    setPendingDecision({
      kind: 'reject',
      reportId,
      reason: rejectionReason.trim(),
    })
  }

  const permissions = user === null ? null : userPermissions(user)
  const actions =
    report === null || permissions === null
      ? null
      : availableReportActions(report, permissions)

  const targets = report === null ? [] : overrideTargets(report.status)
  const priorReport = report?.supersedes ?? null
  const successorId = report?.superseded_by_id ?? null
  const canCorrect =
    report !== null &&
    permissions !== null &&
    canFileCorrection(report, permissions)

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

          <Suspense fallback={<p className="muted">Loading the location map…</p>}>
            <ReportLocationMap report={report} />
          </Suspense>

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
              <dt>Observed at (device)</dt>
              <dd>
                {report.reported_at === null ? (
                  NOT_RECORDED
                ) : (
                  <time dateTime={report.reported_at}>
                    {formatInstantWithAge(report.reported_at)}
                  </time>
                )}
              </dd>
            </div>
            <div>
              <dt>Received at (system)</dt>
              <dd>
                <time dateTime={report.created_at}>
                  {formatInstantWithAge(report.created_at)}
                </time>
              </dd>
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

          {(priorReport !== null || successorId !== null) && (
            <section className="correction-chain" aria-label="Correction chain">
              <h3>Correction chain</h3>
              <ul className="correction-chain-list">
                {priorReport !== null && (
                  <li>
                    <Button
                      variant="quiet"
                      size="compact"
                      onClick={() => onSelect(priorReport.id)}
                    >
                      {correctionLinkLabel(priorReport.id)}
                    </Button>
                    <p className="report-row-meta">
                      {reportStatusLabel(priorReport.status)} ·{' '}
                      {priorReport.returned_reason === null
                        ? 'No return reason recorded.'
                        : `Returned: ${priorReport.returned_reason}`}
                    </p>
                  </li>
                )}
                {successorId !== null && (
                  <li>
                    <Button
                      variant="quiet"
                      size="compact"
                      onClick={() => onSelect(successorId)}
                    >
                      {supersededByLabel(successorId)}
                    </Button>
                    <p className="report-row-meta">
                      Corrected by a new report; this record is kept unchanged.
                    </p>
                  </li>
                )}
              </ul>
            </section>
          )}

          {canCorrect && (
            <section className="correction-cta" aria-label="Correction">
              <h3>Correct this report</h3>
              <p className="muted">
                A correction is a new report that answers this return. The
                returned report stays in the record and is never edited
                (FR-14).
              </p>
              <Button onClick={() => onCorrect(reportId)}>
                File a corrected report
              </Button>
            </section>
          )}

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
                        <time dateTime={change.created_at}>
                          {formatInstantWithAge(change.created_at)}
                        </time>
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
                <Button disabled={isActing} onClick={handleValidate}>
                  Validate report
                </Button>
              )}

              {actions.canReturn && (
                <form className="ui-form" onSubmit={handleReturn} noValidate>
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
                    Return for correction
                  </Button>
                </form>
              )}
            </section>
          )}

          {actions?.canOverride && (
            <form className="ui-form" onSubmit={handleOverride} noValidate>
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
                Override decision
              </Button>
            </form>
          )}

          {actions?.canReject && (
            <form className="ui-form" onSubmit={handleReject} noValidate>
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

              <Button type="submit" variant="danger" disabled={isActing}>
                Reject report
              </Button>
            </form>
          )}
        </>
      )}

      <DecisionDialog
        decision={pendingDecision}
        busy={isActing}
        onCancel={closeDecision}
        onConfirm={() => void confirmDecision()}
      />
    </div>
  )
}

function DecisionDialog({
  decision,
  busy,
  onCancel,
  onConfirm,
}: {
  decision: ReviewDecision | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const copy = decision === null ? null : decisionCopy(decision)

  return (
    <Dialog
      open={copy !== null}
      title={copy?.title ?? ''}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            {DECISION_CANCEL_LABEL}
          </Button>
          <Button
            variant={decision?.kind === 'validate' ? 'primary' : 'danger'}
            disabled={busy}
            aria-busy={busy}
            onClick={onConfirm}
          >
            {busy ? 'Recording…' : copy?.confirm}
          </Button>
        </>
      }
    >
      <p>{copy?.body}</p>
    </Dialog>
  )
}
