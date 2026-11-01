import { describe, expect, it } from 'vitest'
import { describeLatencySummary, formatLatency } from './realtimeLatency'

describe('formatLatency', () => {
  it('uses milliseconds below a second and seconds above', () => {
    expect(formatLatency(850)).toBe('850 ms')
    expect(formatLatency(2_450)).toBe('2.5 s')
    expect(formatLatency(null)).toBe('none')
  })
})

describe('describeLatencySummary', () => {
  it('states that no sample exists instead of showing a zero', () => {
    expect(
      describeLatencySummary({
        windowHours: 24,
        samples: 0,
        excluded: 0,
        medianMs: null,
        maxMs: null,
        boundMs: 3_000,
        breaches: 0,
      }),
    ).toBe('Realtime propagation (24h): no samples yet.')
  })

  it('publishes the median, maximum, sample count, and exclusions', () => {
    expect(
      describeLatencySummary({
        windowHours: 24,
        samples: 12,
        excluded: 2,
        medianMs: 1_200,
        maxMs: 2_450,
        boundMs: 3_000,
        breaches: 0,
      }),
    ).toBe(
      'Realtime propagation (24h): median 1.2 s, max 2.5 s · 12 samples · 2 excluded',
    )
  })

  it('names the bound and the breach count when one is exceeded', () => {
    const text = describeLatencySummary({
      windowHours: 6,
      samples: 3,
      excluded: 1,
      medianMs: 2_000,
      maxMs: 5_000,
      boundMs: 3_000,
      breaches: 1,
    })

    expect(text).toContain('6h')
    expect(text).toContain('1 over 3s')
  })
})
