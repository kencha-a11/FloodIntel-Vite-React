import { reportStatusLabel } from './vocabulary'
import type { OverrideTarget } from './reportActions'
import type { FloodReportStatus } from '../types/report'

export type ReviewDecision =
  | { kind: 'validate'; reportId: number }
  | { kind: 'return'; reportId: number; reason: string }
  | { kind: 'reject'; reportId: number; reason: string }
  | {
      kind: 'override'
      reportId: number
      from: FloodReportStatus
      target: OverrideTarget
      reason: string
    }

export interface DecisionCopy {
  title: string
  body: string
  confirm: string
}

export const DECISION_CANCEL_LABEL = 'Cancel'

/**
 * What the operator reads before a decision that cannot be taken back by
 * editing the report (design §10, §12): the action, its consequence, and the
 * object. Every copy names the consequence rather than asking "are you sure".
 */
export function decisionCopy(decision: ReviewDecision): DecisionCopy {
  switch (decision.kind) {
    case 'validate':
      return {
        title: `Validate report #${decision.reportId}?`,
        body: 'Validated reports are the only ones the map and the situational report use. The status history records who validated it and when.',
        confirm: 'Validate report',
      }
    case 'return':
      return {
        title: `Return report #${decision.reportId} for correction?`,
        body: 'The reporter will see your reason and can resubmit. This report stops counting as awaiting a decision.',
        confirm: 'Return for correction',
      }
    case 'reject':
      return {
        title: `Reject report #${decision.reportId}?`,
        body: 'The reporter will see your reason, and the report stays out of the validated set. An officer can override this decision later, and every change is recorded.',
        confirm: 'Reject report',
      }
    case 'override': {
      const target = reportStatusLabel(decision.target)

      return {
        title: `Override this ${reportStatusLabel(decision.from)} report to ${target}?`,
        body: 'This adds a reasoned entry to the status history; nothing is erased. The new decision replaces the current status.',
        confirm: `Override to ${target}`,
      }
    }
  }
}
