import { describe, expect, it } from 'vitest'
import { DECISION_CANCEL_LABEL, decisionCopy } from './reviewDecision'

/*
 * Design §12: buttons name the action and the object, one term per concept, and
 * copy states a consequence instead of blaming or hedging. These assertions pin
 * what an operator reads before a decision.
 */

describe('decisionCopy', () => {
  it('states what validating does to the report’s downstream use', () => {
    const copy = decisionCopy({ kind: 'validate', reportId: 12 })

    expect(copy.title).toBe('Validate report #12?')
    expect(copy.confirm).toBe('Validate report')
    expect(copy.body).toContain('map and the situational report')
    expect(copy.body).toContain('status history')
  })

  it('tells the operator that a return reaches the reporter', () => {
    const copy = decisionCopy({ kind: 'return', reportId: 7, reason: 'Blurred photo' })

    expect(copy.title).toBe('Return report #7 for correction?')
    expect(copy.confirm).toBe('Return for correction')
    expect(copy.body).toContain('reporter will see your reason')
  })

  it('does not call a rejection permanent, because an override follows the same trail', () => {
    const copy = decisionCopy({ kind: 'reject', reportId: 3, reason: 'Duplicate' })

    expect(copy.title).toBe('Reject report #3?')
    expect(copy.confirm).toBe('Reject report')
    expect(copy.body).toContain('override this decision later')
    expect(copy.body).not.toMatch(/cannot be undone|permanent/i)
  })

  it('names both the current status and the override target', () => {
    const copy = decisionCopy({
      kind: 'override',
      reportId: 5,
      from: 'validated',
      target: 'rejected',
      reason: 'Observed depth not credible',
    })

    expect(copy.title).toBe('Override this Validated report to Rejected?')
    expect(copy.confirm).toBe('Override to Rejected')
    expect(copy.body).toContain('nothing is erased')
  })

  it('offers one cancel label for every decision', () => {
    expect(DECISION_CANCEL_LABEL).toBe('Cancel')
  })
})
