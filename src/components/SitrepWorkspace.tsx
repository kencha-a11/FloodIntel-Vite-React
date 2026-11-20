import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Badge, Button, Card, Dialog, EmptyState, Field, Select, Spinner, TextInput } from './ui'
import { getStoredToken } from '../lib/http'
import { formatAbsoluteInstant } from '../lib/dateTime'
import { listBarangays } from '../lib/reportApi'
import { listOpenEvents } from '../lib/impactApi'
import { downloadBlob } from '../lib/reportExport'
import { sectionLabel } from '../lib/sitrepSections'
import { runStateLabel, runStateTone } from '../lib/sitrepRuns'
import * as sitrepApi from '../lib/sitrepApi'
import type {
  SituationalReport,
  SitrepRunStatusRow,
  SitrepSupplement,
} from '../types/sitrep'
import type { Barangay } from '../types/report'
import type { ImpactEvent } from '../types/impact'
import { SitrepSupplementForm } from './SitrepSupplementForm'

/*
 * The command-center SITREP workspace (D-42, D-43, D-147). Preparation freezes
 * a snapshot; the preview and exports render only that frozen revision. The
 * cutoff strip makes a missed run visible without a backdated row, and
 * issuance is officer-only and append-only. Every figure is the server's;
 * the client never re-derives one.
 */

export function SitrepRunStrip({ rows }: { rows: SitrepRunStatusRow[] }) {
  if (rows.length === 0) {
    return null
  }

  return (
    <ul className="sitrep-run-strip" aria-label="Recent consolidation cutoffs">
      {rows.map((row) => (
        <li key={row.cutoff_at} className="sitrep-run">
          <Badge tone={runStateTone(row.state)}>{runStateLabel(row.state)}</Badge>
          <span className="sitrep-run-cutoff">{row.cutoff_label}</span>
          {row.state === 'failed' && row.reason !== null && (
            <span className="sitrep-run-reason muted">{row.reason}</span>
          )}
          {row.state === 'not_run' && (
            <span className="sitrep-run-reason muted">No attempt was recorded for this cutoff.</span>
          )}
        </li>
      ))}
    </ul>
  )
}

export function SitrepReportList({
  reports,
  selectedId,
  onSelect,
}: {
  reports: SituationalReport[]
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  if (reports.length === 0) {
    return (
      <EmptyState
        title="No situational reports yet"
        description="Prepare a snapshot for the current window, or wait for the next cutoff."
      />
    )
  }

  return (
    <ul className="sitrep-report-list">
      {reports.map((report) => (
        <li key={report.id}>
          <button
            type="button"
            className={
              report.id === selectedId ? 'sitrep-report is-selected' : 'sitrep-report'
            }
            aria-current={report.id === selectedId ? 'true' : undefined}
            onClick={() => onSelect(report.id)}
          >
            <span className="sitrep-report-cutoff">{report.cutoff_label}</span>
            <span className="sitrep-report-meta muted">
              Revision {report.revision} · {report.generated_by_name}
            </span>
            {report.issuance != null ? (
              <Badge tone="success">Issued #{report.issuance.report_number}</Badge>
            ) : (
              <Badge tone="neutral">Draft</Badge>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}

function SitrepDetail({
  token,
  report,
  canIssue,
  onIssued,
}: {
  token: string
  report: SituationalReport
  canIssue: boolean
  onIssued: () => void
}) {
  const [html, setHtml] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [issueOpen, setIssueOpen] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    let cancelled = false
    setHtml(null)
    setPreviewError(null)

    async function load(): Promise<void> {
      try {
        const next = await sitrepApi.fetchSitrepDocumentHtml(token, report.id)

        if (!cancelled) {
          setHtml(next)
        }
      } catch (err) {
        if (!cancelled) {
          setPreviewError(err instanceof Error ? err.message : 'Unable to render the preview.')
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [token, report.id])

  async function downloadDocx(): Promise<void> {
    setActionError(null)
    setDownloading(true)

    try {
      const blob = await sitrepApi.fetchSitrepDocx(token, report.id)
      downloadBlob(blob, sitrepApi.sitrepDocxFilename(report))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to download the DOCX.')
    } finally {
      setDownloading(false)
    }
  }

  function print(): void {
    frameRef.current?.contentWindow?.print()
  }

  const issued = report.issuance != null

  return (
    <Card label="Situational report detail" className="sitrep-detail">
      <div className="sitrep-detail-head">
        <div>
          <h2>{report.cutoff_label}</h2>
          <p className="muted">
            Revision {report.revision} · window {formatAbsoluteInstant(report.window_starts_at)} to{' '}
            {formatAbsoluteInstant(report.window_ends_at)} · snapshot{' '}
            {formatAbsoluteInstant(report.snapshot_at)}
          </p>
          <p className="muted">
            Prepared by {report.generated_by_name}
            {report.event_id === null ? ' · no linked event (stage-1 figures only)' : ''}
          </p>
        </div>
        {issued ? (
          <Badge tone="success">Issued #{report.issuance?.report_number}</Badge>
        ) : (
          <Badge tone="neutral">Unissued draft</Badge>
        )}
      </div>

      {issued && report.issuance != null && (
        <Alert tone="success">
          Issued by {report.issuance.issued_by_name} on {formatAbsoluteInstant(report.issuance.issued_at)}.
          Issuance is permanent; a correction means a new revision.
        </Alert>
      )}

      {actionError !== null && <Alert tone="danger">{actionError}</Alert>}

      <div className="sitrep-detail-actions">
        <Button variant="secondary" onClick={print} disabled={html === null}>
          Print
        </Button>
        <Button variant="secondary" onClick={() => void downloadDocx()} disabled={downloading}>
          {downloading ? 'Downloading…' : 'Download DOCX'}
        </Button>
        {canIssue && !issued && (
          <Button onClick={() => setIssueOpen(true)}>Issue…</Button>
        )}
      </div>

      {previewError !== null && <Alert tone="danger">{previewError}</Alert>}

      {html === null && previewError === null && <Spinner label="Rendering the frozen document…" />}

      {html !== null && (
        <iframe
          ref={frameRef}
          title={`Situational report revision ${report.revision}`}
          className="sitrep-preview"
          srcDoc={html}
          sandbox="allow-same-origin allow-modals"
        />
      )}

      <SitrepIssueDialog
        token={token}
        report={report}
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        onIssued={() => {
          setIssueOpen(false)
          onIssued()
        }}
      />
    </Card>
  )
}

function SitrepIssueDialog({
  token,
  report,
  open,
  onClose,
  onIssued,
}: {
  token: string
  report: SituationalReport
  open: boolean
  onClose: () => void
  onIssued: () => void
}) {
  const [thru, setThru] = useState('')
  const [signatory, setSignatory] = useState('')
  const [signatoryTitle, setSignatoryTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [issuing, setIssuing] = useState(false)

  async function issue(): Promise<void> {
    setError(null)
    setIssuing(true)

    try {
      const office: Record<string, string> = {}

      if (thru.trim() !== '') office.thru = thru.trim()
      if (signatory.trim() !== '') office.signatory = signatory.trim()
      if (signatoryTitle.trim() !== '') office.signatory_title = signatoryTitle.trim()

      await sitrepApi.issueSitrep(token, report.id, office)
      onIssued()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to issue the report.')
    } finally {
      setIssuing(false)
    }
  }

  return (
    <Dialog
      open={open}
      title="Issue this situational report"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={issuing}>
            Cancel
          </Button>
          <Button onClick={() => void issue()} disabled={issuing}>
            {issuing ? 'Issuing…' : 'Issue permanently'}
          </Button>
        </>
      }
    >
      <p>
        Issuing assigns the next report number for this event and freezes the office block.
        It cannot be undone — a correction means preparing and issuing a new revision.
      </p>
      <p className="muted">
        Official issuance still depends on the receiving office's dated acceptance of the
        aggregate-only adaptation (gate G8); that acceptance is recorded outside this system.
      </p>

      <Field id="sitrep-issue-thru" label="Thru (optional)" hint="Leave blank to use the configured office.">
        <TextInput value={thru} onChange={(event) => setThru(event.target.value)} />
      </Field>
      <Field id="sitrep-issue-signatory" label="Signatory (optional)">
        <TextInput value={signatory} onChange={(event) => setSignatory(event.target.value)} />
      </Field>
      <Field id="sitrep-issue-signatory-title" label="Signatory title (optional)">
        <TextInput value={signatoryTitle} onChange={(event) => setSignatoryTitle(event.target.value)} />
      </Field>

      {error !== null && <Alert tone="danger">{error}</Alert>}
    </Dialog>
  )
}

export function SitrepWorkspace({ canIssue }: { canIssue: boolean }) {
  const [token] = useState(getStoredToken)
  const [reports, setReports] = useState<SituationalReport[]>([])
  const [runs, setRuns] = useState<SitrepRunStatusRow[]>([])
  const [events, setEvents] = useState<ImpactEvent[]>([])
  const [barangays, setBarangays] = useState<Barangay[]>([])
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null)
  const [supplements, setSupplements] = useState<SitrepSupplement[]>([])
  const [editing, setEditing] = useState<SitrepSupplement | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loaded, setLoaded] = useState(token === null)
  const [error, setError] = useState<string | null>(
    token === null ? 'Sign in again to load the situational reports.' : null,
  )
  const [preparing, setPreparing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
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
        const [nextReports, nextRuns, nextEvents, nextBarangays] = await Promise.all([
          sitrepApi.listSitrepReports(token),
          sitrepApi.listSitrepRuns(token),
          listOpenEvents(token),
          listBarangays(token),
        ])

        if (cancelled) {
          return
        }

        setReports(nextReports)
        setRuns(nextRuns)
        setEvents(nextEvents)
        setBarangays(nextBarangays)
        setSelectedEventId((current) => current ?? nextEvents[0]?.id ?? null)
        setError(null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load the situational reports.')
        }
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

  useEffect(() => {
    let cancelled = false

    async function loadSupplements(): Promise<void> {
      if (token === null || selectedEventId === null) {
        setSupplements([])
        return
      }

      try {
        const next = await sitrepApi.listSitrepSupplements(token, selectedEventId)

        if (!cancelled) {
          setSupplements(next)
        }
      } catch {
        if (!cancelled) {
          setSupplements([])
        }
      }
    }

    void loadSupplements()

    return () => {
      cancelled = true
    }
  }, [token, selectedEventId, reloadKey])

  async function prepare(): Promise<void> {
    if (token === null) {
      return
    }

    setPreparing(true)
    setNotice(null)
    setError(null)

    try {
      const report = await sitrepApi.prepareSitrep(token, selectedEventId)
      setSelectedReportId(report.id)
      setNotice(`Prepared revision ${report.revision} for ${report.cutoff_label}.`)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to prepare the snapshot.')
    } finally {
      setPreparing(false)
    }
  }

  async function removeSupplement(id: number): Promise<void> {
    if (token === null) {
      return
    }

    try {
      await sitrepApi.deleteSitrepSupplement(token, id)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete the draft.')
    }
  }

  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? null

  if (!loaded) {
    return <Spinner label="Loading the situational reports…" />
  }

  return (
    <div className="sitrep-workspace">
      <Card label="Prepare a situational report" className="sitrep-prepare">
        <h2>Situational reports</h2>
        <p className="muted">
          Prepare a frozen snapshot for the current consolidation window. Supplements you draft
          below are included in the next preparation; an issued revision never changes.
        </p>

        <SitrepRunStrip rows={runs} />

        <div className="sitrep-prepare-controls">
          <Field id="sitrep-event" label="Flood event" hint="Figures are cumulative for the chosen event.">
            <Select
              value={selectedEventId ?? ''}
              onChange={(event) =>
                setSelectedEventId(event.target.value === '' ? null : Number(event.target.value))
              }
            >
              <option value="">No event (stage-1 figures only)</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </Select>
          </Field>
          <Button onClick={() => void prepare()} disabled={preparing}>
            {preparing ? 'Preparing…' : 'Prepare snapshot'}
          </Button>
        </div>

        {notice !== null && <Alert tone="success">{notice}</Alert>}
        {error !== null && <Alert tone="danger">{error}</Alert>}
      </Card>

      <div className="sitrep-columns">
        <Card label="Prepared revisions" className="sitrep-list-card">
          <h2>Revisions</h2>
          <SitrepReportList
            reports={reports}
            selectedId={selectedReportId}
            onSelect={setSelectedReportId}
          />
        </Card>

        {selectedReport !== null && token !== null && (
          <SitrepDetail
            token={token}
            report={selectedReport}
            canIssue={canIssue}
            onIssued={refresh}
          />
        )}
      </div>

      <Card label="Supplement drafts" className="sitrep-supplements">
        <div className="sitrep-supplements-head">
          <h2>Supplement drafts</h2>
          {selectedEventId !== null && !showForm && (
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(null)
                setShowForm(true)
              }}
            >
              Add draft
            </Button>
          )}
        </div>

        {selectedEventId === null ? (
          <p className="muted">Choose a flood event to draft its supplements.</p>
        ) : (
          <>
            {showForm && token !== null && (
              <SitrepSupplementForm
                token={token}
                eventId={selectedEventId}
                barangays={barangays}
                editing={editing}
                onSaved={() => {
                  setShowForm(false)
                  setEditing(null)
                  refresh()
                }}
                onCancel={() => {
                  setShowForm(false)
                  setEditing(null)
                }}
              />
            )}

            {supplements.length === 0 && !showForm ? (
              <p className="muted">No supplements drafted for this event yet.</p>
            ) : (
              <ul className="sitrep-supplement-list">
                {supplements.map((supplement) => (
                  <li key={supplement.id} className="sitrep-supplement">
                    <div>
                      <strong>{sectionLabel(supplement.section)}</strong>
                      {supplement.barangay != null && (
                        <span className="muted"> · {supplement.barangay}</span>
                      )}
                      <span className="muted"> · {supplement.created_by_name}</span>
                    </div>
                    <div className="sitrep-supplement-actions">
                      <Button
                        variant="quiet"
                        size="compact"
                        onClick={() => {
                          setEditing(supplement)
                          setShowForm(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="compact"
                        onClick={() => void removeSupplement(supplement.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>
    </div>
  )
}