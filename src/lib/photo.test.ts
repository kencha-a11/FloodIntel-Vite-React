import { describe, expect, it } from 'vitest'
import { buildEncodingPlan, fitsBudget } from './photo'
import { MAX_PHOTO_EDGE, MIN_PHOTO_EDGE } from './floodLevels'

describe('buildEncodingPlan', () => {
  it('starts at the maximum edge and steps down to the minimum', () => {
    const plan = buildEncodingPlan(6000)
    const edges = [...new Set(plan.map((candidate) => candidate.edge))]

    expect(edges).toEqual([MAX_PHOTO_EDGE, 1024, 512, MIN_PHOTO_EDGE])
  })

  it('never upscales a small photo', () => {
    const plan = buildEncodingPlan(120)

    expect(plan.every((candidate) => candidate.edge === MIN_PHOTO_EDGE)).toBe(
      true,
    )
  })

  it('tries every quality step for each edge, best quality first', () => {
    const plan = buildEncodingPlan(MIN_PHOTO_EDGE)
    const qualities = plan.map((candidate) => candidate.quality)

    expect(qualities).toEqual([0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3])
  })

  it('handles degenerate dimensions', () => {
    expect(buildEncodingPlan(0).length).toBeGreaterThan(0)
  })
})

describe('fitsBudget', () => {
  it('accepts a non-empty blob at or below the budget', () => {
    expect(fitsBudget({ size: 1024 }, 1024)).toBe(true)
    expect(fitsBudget({ size: 512 }, 1024)).toBe(true)
  })

  it('rejects empty blobs and oversized blobs', () => {
    expect(fitsBudget({ size: 0 }, 1024)).toBe(false)
    expect(fitsBudget({ size: 1025 }, 1024)).toBe(false)
  })
})
