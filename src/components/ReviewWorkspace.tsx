import { useEffect, useRef } from 'react'
import type { Permissions } from '../lib/permissions'
import { EmptyState } from './ui'
import { ReportDetail } from './ReportDetail'
import { ReportList } from './ReportList'

/**
 * Design §10's review workspace: the queue stays visible while a report is
 * open at 1024 px and above; below that it is list → detail. Both panes are
 * always in the markup — the CSS decides which one a viewport shows — so the
 * queue's filters survive opening and closing a report.
 */
export function ReviewWorkspace({
  permissions,
  selectedReportId,
  onSelect,
  onClear,
  onCorrect,
}: {
  permissions: Permissions
  selectedReportId: number | null
  onSelect: (reportId: number) => void
  onClear: () => void
  onCorrect: (reportId: number) => void
}) {
  const queueRef = useRef<HTMLElement | null>(null)
  const detailRef = useRef<HTMLElement | null>(null)
  const previousSelection = useRef<number | null>(null)

  useEffect(() => {
    if (selectedReportId !== null) {
      detailRef.current?.focus({ preventScroll: true })
    } else if (previousSelection.current !== null) {
      queueRef.current?.focus({ preventScroll: true })
    }

    previousSelection.current = selectedReportId
  }, [selectedReportId])

  return (
    <div
      className={
        selectedReportId === null
          ? 'review-workspace'
          : 'review-workspace has-selection'
      }
    >
      <section
        ref={queueRef}
        className="review-workspace-queue"
        aria-label="Review queue"
        tabIndex={-1}
      >
        <ReportList
          permissions={permissions}
          selectedReportId={selectedReportId}
          onSelect={onSelect}
        />
      </section>

      <section
        ref={detailRef}
        className="review-workspace-detail"
        aria-label="Selected report"
        tabIndex={-1}
      >
        {selectedReportId === null ? (
          <EmptyState
            title="No report selected."
            description="Choose a report from the queue to review its evidence and record a decision."
          />
        ) : (
          <ReportDetail
            key={selectedReportId}
            reportId={selectedReportId}
            onBack={onClear}
            onSelect={onSelect}
            onCorrect={onCorrect}
          />
        )}
      </section>
    </div>
  )
}
