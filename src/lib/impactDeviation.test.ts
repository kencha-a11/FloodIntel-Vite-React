import { describe, expect, it } from 'vitest'
import {
  IMPACT_DEVIATION_THRESHOLD_PERCENT,
  deviationPercent,
  deviationWarning,
} from './impactDeviation'

describe('deviationPercent', () => {
  it('measures the move from the previous report in either direction', () => {
    expect(deviationPercent(120, 100)).toBe(20)
    expect(deviationPercent(80, 100)).toBe(20)
    expect(deviationPercent(100, 100)).toBe(0)
  })
})

describe('deviationWarning', () => {
  it('stays silent without a previous report to compare against', () => {
    expect(deviationWarning(240, null)).toBeNull()
  })

  it('stays silent when the previous count is zero or negative', () => {
    expect(deviationWarning(240, 0)).toBeNull()
    expect(deviationWarning(240, -5)).toBeNull()
  })

  it('stays silent at exactly the threshold', () => {
    expect(IMPACT_DEVIATION_THRESHOLD_PERCENT).toBe(20)
    expect(deviationWarning(120, 100)).toBeNull()
    expect(deviationWarning(80, 100)).toBeNull()
  })

  it('warns as soon as the move passes the threshold', () => {
    const warning = deviationWarning(121, 100)

    expect(warning).not.toBeNull()
    expect(warning).toContain('121')
    expect(warning).toContain('21%')
    expect(warning).toContain('higher')
    expect(warning).toContain('100')
  })

  it('names the direction of a drop', () => {
    const warning = deviationWarning(70, 100)

    expect(warning).toContain('30%')
    expect(warning).toContain('lower')
  })

  it('rounds the percentage for the message', () => {
    expect(deviationWarning(130, 100)).toContain('30%')
    expect(deviationWarning(123, 100)).toContain('23%')
  })

  it('caps an implausible move instead of printing a huge percentage', () => {
    expect(deviationWarning(2000, 1)).toContain('more than 999%')
  })

  it('accepts a caller-supplied threshold', () => {
    expect(deviationWarning(110, 100, 5)).not.toBeNull()
    expect(deviationWarning(110, 100, 50)).toBeNull()
  })
})
