import type { UserRole } from '../types/auth'
import type { FloodReportStatus } from '../types/report'

const VALIDATE_REPORT = 'validate-report'
const OVERRIDE_VALIDATION = 'override-validation'

export interface ReportActions {
  canValidate: boolean
  canReturn: boolean
  canOverride: boolean
  canReject: boolean
}

/**
 * The decision controls D-23 allows for this report and this caller.
 * Rejection is fenced by the officer-only route group, so it keys on the role.
 */
export function availableReportActions(
  report: { status: FloodReportStatus },
  abilities: readonly string[],
  role: UserRole | undefined,
): ReportActions {
  const submitted = report.status === 'submitted'
  const decided =
    report.status === 'validated' || report.status === 'returned'

  return {
    canValidate: submitted && abilities.includes(VALIDATE_REPORT),
    canReturn: submitted && abilities.includes(VALIDATE_REPORT),
    canOverride: decided && abilities.includes(OVERRIDE_VALIDATION),
    canReject: submitted && role === 'mdrrmo_officer',
  }
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
