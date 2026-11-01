import type { FloodReportStatus } from '../types/report'
import type { Permissions } from './permissions'

export interface ReportActions {
  canValidate: boolean
  canReturn: boolean
  canOverride: boolean
  canReject: boolean
}

/**
 * The decision controls D-23 allows for this report and this caller.
 * Rejection is fenced by the officer-only route group, so `rejectReports`
 * carries the role rule (D-113).
 */
export function availableReportActions(
  report: { status: FloodReportStatus },
  permissions: Permissions,
): ReportActions {
  const submitted = report.status === 'submitted'
  const decided =
    report.status === 'validated' || report.status === 'returned'

  return {
    canValidate: submitted && permissions.reviewReports,
    canReturn: submitted && permissions.reviewReports,
    canOverride: decided && permissions.overrideValidation,
    canReject: submitted && permissions.rejectReports,
  }
}

/**
 * FR-14: a correction is a new report that answers a return, so only the
 * returned head of a chain offers the affordance — never an edit.
 */
export function canFileCorrection(
  report: {
    status: FloodReportStatus
    superseded_by_id?: number | null
  },
  permissions: Permissions,
): boolean {
  return (
    report.status === 'returned' &&
    (report.superseded_by_id ?? null) === null &&
    permissions.fileFloodReport
  )
}

export type OverrideTarget = 'validated' | 'returned' | 'rejected'

/**
 * D-21's override targets for a decided report; an empty list means no override.
 */
export function overrideTargets(status: FloodReportStatus): OverrideTarget[] {
  if (status === 'validated') {
    return ['returned', 'rejected']
  }

  if (status === 'returned') {
    return ['validated', 'rejected']
  }

  return []
}
