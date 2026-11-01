import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/useAuth'
import { useQueue } from '../context/useQueue'
import { Alert, Button, EmptyState, Field, Select, Spinner, Textarea, TextInput } from './ui'
import { getStoredToken } from '../lib/http'
import * as impactApi from '../lib/impactApi'
import { deviationWarning } from '../lib/impactDeviation'
import * as reportApi from '../lib/reportApi'
import { alertTierShortLabel, floodLevelLabel } from '../lib/vocabulary'
import {
  relatedReportCandidates,
  relatedReportIdsLabel,
  toggleRelatedReport,
} from '../lib/relatedReports'
import type { FloodImpactReport, ImpactEvent } from '../types/impact'
import type { FloodReport } from '../types/report'

type FormStep = 'form' | 'confirm' | 'success'

interface SubmitSummary {
  queued: boolean
  reportId: number | null
  message: string
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

function currentTimestamp(): string {
  return new Date().toISOString()
}

function levelReportLabel(report: FloodReport): string {
  const tier =
    report.alert_level === null ? null : alertTierShortLabel(report.alert_level)
  const subject = tier ?? floodLevelLabel(report.flood_level) ?? 'Report'

  return `#${report.id} · ${subject} · ${formatDateTime(report.reported_at ?? report.created_at)}`
}

function parseCount(value: string): number | null {
  if (value.trim() === '') {
    return null
  }

  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

interface FloodImpactReportFormProps {
  reports: FloodImpactReport[]
  onFiled: () => void
}

export function FloodImpactReportForm({
  reports,
  onFiled,
}: FloodImpactReportFormProps) {
  const { user } = useAuth()
  const { submitImpactReport } = useQueue()
  const [initial] = useState(() => ({
    events: impactApi.readCachedEvents(),
    token: getStoredToken(),
  }))
  const [step, setStep] = useState<FormStep>('form')
  const [events, setEvents] = useState<ImpactEvent[] | null>(
    initial.events.length > 0
      ? initial.events
      : initial.token === null
        ? []
        : null,
  )
  const [eventsError, setEventsError] = useState<string | null>(
    initial.events.length === 0 && initial.token === null
      ? 'Sign in again to load the open flood events.'
      : null,
  )
  const [eventId, setEventId] = useState<number | null>(
    initial.events[0]?.id ?? null,
  )
  const [familiesInput, setFamiliesInput] = useState('')
  const [individualsInput, setIndividualsInput] = useState('')
  const [supersedesId, setSupersedesId] = useState<number | null>(null)
  const [levelReports, setLevelReports] = useState<FloodReport[]>([])
  const [relatedIds, setRelatedIds] = useState<number[]>([])
  const [remarks, setRemarks] = useState('')
  const [observedAt, setObservedAt] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [summary, setSummary] = useState<SubmitSummary | null>(null)
  const [failedQueueId, setFailedQueueId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const token = initial.token

    if (token === null) {
      return
    }

    void impactApi
      .listOpenEvents(token)
      .then((open) => {
        if (cancelled) {
          return
        }

        setEvents(open)
        setEventsError(null)
        setEventId((current) =>
          current !== null && open.some((event) => event.id === current)
            ? current
            : (open[0]?.id ?? null),
        )
      })
      .catch(() => {
        if (!cancelled && initial.events.length === 0) {
          setEvents([])
          setEventsError(
            navigator.onLine
              ? 'Unable to load the open flood events.'
              : 'You are offline and no event list is saved on this device.',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [initial])

  useEffect(() => {
    let cancelled = false
    const token = initial.token

    if (token === null) {
      return
    }

    void reportApi
      .listRecentReports(token)
      .then((reports) => {
        if (!cancelled) {
          setLevelReports(relatedReportCandidates(reports))
        }
      })
      .catch(() => {
        // The link is optional; an unavailable list only hides the picker.
      })

    return () => {
      cancelled = true
    }
  }, [initial])

  const families = parseCount(familiesInput)
  const individuals = parseCount(individualsInput)
  const previousFamilies = impactApi.previousFamiliesFor(reports, eventId)
  const warning =
    families === null ? null : deviationWarning(families, previousFamilies)
  const selectedEvent = events?.find((event) => event.id === eventId) ?? null
  const correctable = impactApi.correctableReports(reports, eventId)
  const corrected =
    reports.find((report) => report.id === supersedesId) ?? null

  function validate(): boolean {
    const next: Record<string, string> = {}

    if (eventId === null) {
      next.event_id = 'Select the flood event this report belongs to.'
    }

    if (families === null) {
      next.families = 'Enter the number of affected families.'
    }

    if (individuals === null) {
      next.individuals = 'Enter the number of affected individuals.'
    } else if (families !== null && individuals < families) {
      next.individuals = 'Individuals must be at least the number of families.'
    }

    if (
      supersedesId !== null &&
      !correctable.some((report) => report.id === supersedesId)
    ) {
      next.supersedes_id =
        'That report can no longer be corrected; choose the current report.'
    }

    setErrors(next)

    return Object.keys(next).length === 0
  }

  function handleReview(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setError(null)

    if (validate()) {
      setObservedAt(currentTimestamp())
      setStep('confirm')
    }
  }

  async function handleSubmit(): Promise<void> {
    if (
      isSubmitting ||
      eventId === null ||
      families === null ||
      individuals === null
    ) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    const filedAt = observedAt ?? currentTimestamp()

    try {
      const result = await submitImpactReport({
        payload: {
          event_id: eventId,
          families,
          individuals,
          breakdown: null,
          related_level_report_ids: relatedIds.length === 0 ? null : relatedIds,
          remarks: remarks.trim() === '' ? null : remarks.trim(),
          reported_at: filedAt,
          supersedes_id: supersedesId,
        },
        observedAt: filedAt,
        replaceQueueId: failedQueueId ?? undefined,
      })

      if (result.failed) {
        setFailedQueueId(result.id)
        setError(result.message)
        return
      }

      setFailedQueueId(null)
      setSummary({
        queued: result.queued,
        reportId: result.reportId,
        message: result.message,
      })
      setStep('success')
      onFiled()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save the report.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm(): void {
    setStep('form')
    setFamiliesInput('')
    setIndividualsInput('')
    setSupersedesId(null)
    setRelatedIds([])
    setRemarks('')
    setObservedAt(null)
    setErrors({})
    setError(null)
    setSummary(null)
    setFailedQueueId(null)
  }

  if (step === 'success' && summary !== null) {
    return (
      <div className="report-form">
        <h2>{summary.queued ? 'Impact report saved' : 'Impact report filed'}</h2>

        <Alert tone="success">
          {summary.message}
          {summary.reportId !== null && !summary.queued
            ? ` Report #${summary.reportId} is now with the command center.`
            : ''}
        </Alert>

        <div className="report-form-actions">
          <Button variant="secondary" onClick={resetForm}>
            File another
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'confirm' && observedAt !== null) {
    return (
      <div className="report-form">
        <h2>Review impact report</h2>
        <p className="muted">
          Only the totals recorded here are sent. A filed report cannot be
          edited; file a new one to supersede it.
        </p>

        {error && <Alert tone="danger">{error}</Alert>}

        <dl className="report-summary">
          <div>
            <dt>Event</dt>
            <dd>{selectedEvent?.title ?? 'Selected event'}</dd>
          </div>
          <div>
            <dt>Barangay</dt>
            <dd>{user?.barangay?.name ?? 'Assigned automatically'}</dd>
          </div>
          <div>
            <dt>Families</dt>
            <dd>{families ?? 0}</dd>
          </div>
          <div>
            <dt>Individuals</dt>
            <dd>{individuals ?? 0}</dd>
          </div>
          <div>
            <dt>Observed at</dt>
            <dd>{formatDateTime(observedAt)}</dd>
          </div>
          <div>
            <dt>Remarks</dt>
            <dd>{remarks.trim() === '' ? 'None' : remarks.trim()}</dd>
          </div>
          {corrected !== null && (
            <div>
              <dt>Corrects</dt>
              <dd>
                Report #{corrected.id} ({corrected.families} families)
              </dd>
            </div>
          )}
          <div>
            <dt>Related level reports</dt>
            <dd>{relatedReportIdsLabel(relatedIds)}</dd>
          </div>
        </dl>

        {warning !== null && <Alert tone="warning">{warning}</Alert>}

        <div className="report-form-actions">
          <Button
            variant="secondary"
            disabled={isSubmitting}
            onClick={() => setStep('form')}
          >
            Back
          </Button>
          <Button disabled={isSubmitting} onClick={() => void handleSubmit()}>
            {isSubmitting ? 'Submitting…' : 'Submit impact report'}
          </Button>
        </div>
      </div>
    )
  }

  if (events === null) {
    return <Spinner label="Loading flood events…" />
  }

  if (eventsError !== null || events.length === 0) {
    return (
      <EmptyState
        title="No open flood event"
        description={
          eventsError ??
          'The command center must open a flood event before barangays can file impact reports.'
        }
      />
    )
  }

  return (
    <form className="ui-form report-form" onSubmit={handleReview} noValidate>
      <h2>New impact report</h2>

      {error && <Alert tone="danger">{error}</Alert>}

      <Field id="impact-event" label="Flood event" error={errors.event_id}>
        <Select
          value={eventId === null ? '' : String(eventId)}
          onChange={(event) => {
            setEventId(Number(event.target.value))
            setSupersedesId(null)
          }}
        >
          {events.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </Select>
      </Field>

      <Field id="impact-families" label="Affected families" error={errors.families}>
        <TextInput
          type="number"
          min={0}
          inputMode="numeric"
          value={familiesInput}
          onChange={(event) => setFamiliesInput(event.target.value)}
        />
      </Field>

      <Field
        id="impact-individuals"
        label="Affected individuals"
        error={errors.individuals}
      >
        <TextInput
          type="number"
          min={0}
          inputMode="numeric"
          value={individualsInput}
          onChange={(event) => setIndividualsInput(event.target.value)}
        />
      </Field>

      {previousFamilies !== null && (
        <p className="muted">
          Previous report in this event: {previousFamilies} families.
        </p>
      )}

      {correctable.length > 0 && (
        <Field
          id="impact-supersedes"
          label="Correct a previous report (optional)"
          hint="The selected report is marked superseded and kept for the record."
          error={errors.supersedes_id}
        >
          <Select
            value={supersedesId === null ? '' : String(supersedesId)}
            onChange={(event) =>
              setSupersedesId(
                event.target.value === '' ? null : Number(event.target.value),
              )
            }
          >
            <option value="">Not a correction</option>
            {correctable.map((report) => (
              <option key={report.id} value={report.id}>
                #{report.id} · {report.families} families ·{' '}
                {formatDateTime(report.reported_at ?? report.created_at)}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {levelReports.length > 0 && (
        <fieldset className="field">
          <legend className="field-label">Related flood reports (optional)</legend>
          <small id="impact-related-hint" className="field-hint">
            Pick the level reports this impact counts. Only reports from your
            barangay are listed.
          </small>
          <div
            className="related-reports"
            role="group"
            aria-describedby="impact-related-hint"
          >
            {levelReports.map((report) => {
              const selected = relatedIds.includes(report.id)

              return (
                <Button
                  key={report.id}
                  variant={selected ? 'primary' : 'secondary'}
                  size="compact"
                  aria-pressed={selected}
                  onClick={() =>
                    setRelatedIds((current) =>
                      toggleRelatedReport(current, report.id),
                    )
                  }
                >
                  {levelReportLabel(report)}
                </Button>
              )
            })}
          </div>
        </fieldset>
      )}

      {warning !== null && <Alert tone="warning">{warning}</Alert>}

      <Field id="impact-remarks" label="Remarks (optional)">
        <Textarea
          value={remarks}
          maxLength={2000}
          rows={3}
          onChange={(event) => setRemarks(event.target.value)}
        />
      </Field>

      <p className="muted">
        Barangay: {user?.barangay?.name ?? 'assigned automatically'} · Filed
        against your account.
      </p>

      <Button type="submit">Review impact report</Button>
    </form>
  )
}
