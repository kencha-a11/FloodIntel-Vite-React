import { useAuth } from '../context/useAuth'
import { relatedReportIdsLabel } from '../lib/relatedReports'
import { Alert, Badge, EmptyState, Spinner } from './ui'
import type { FloodImpactReport } from '../types/impact'

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  superseded: 'Superseded',
}

function formatDateTime(value: string | null): string {
  return value === null ? 'Not recorded' : new Date(value).toLocaleString()
}

interface BarangayImpactStatusViewProps {
  reports: FloodImpactReport[] | null
  error: string | null
}

export function BarangayImpactStatusView({
  reports,
  error,
}: BarangayImpactStatusViewProps) {
  const { user } = useAuth()

  if (reports === null) {
    return <Spinner label="Loading impact reports…" />
  }

  return (
    <div className="report-form">
      <h2>Barangay impact reports</h2>
      <p className="muted">
        {user?.barangay?.name ?? 'Your barangay'} · filed reports cannot be
        edited; a newer report supersedes an earlier one.
      </p>

      {error !== null && <Alert tone="danger">{error}</Alert>}

      {reports.length === 0 ? (
        <EmptyState
          title="No impact report filed yet."
          description="File an impact report when flooding affects families in the barangay."
        />
      ) : (
        <ul className="report-items">
          {reports.map((report) => {
            const superseder = reports.find(
              (candidate) => candidate.supersedes_id === report.id,
            )

            return (
              <li key={report.id}>
                <div className="report-row">
                  <div className="report-row-body">
                    <div className="report-row-header">
                      <Badge
                        tone={report.status === 'superseded' ? 'neutral' : 'success'}
                      >
                        {STATUS_LABELS[report.status] ?? report.status}
                      </Badge>
                      <span className="report-row-meta">
                        Event #{report.event_id}
                      </span>
                      {superseder !== undefined && (
                        <span className="report-row-meta">
                          Superseded by #{superseder.id}
                        </span>
                      )}
                    </div>
                    <p className="report-row-meta">
                      {report.families} families · {report.individuals} individuals
                    </p>
                    <p className="report-row-meta">
                      Observed {formatDateTime(report.reported_at)}
                    </p>
                    {report.related_level_report_ids !== null &&
                      report.related_level_report_ids !== undefined &&
                      report.related_level_report_ids.length > 0 && (
                        <p className="report-row-meta">
                          Related level reports:{' '}
                          {relatedReportIdsLabel(report.related_level_report_ids)}
                        </p>
                      )}
                    {report.remarks !== null && report.remarks !== '' && (
                      <p className="report-row-notes">{report.remarks}</p>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
