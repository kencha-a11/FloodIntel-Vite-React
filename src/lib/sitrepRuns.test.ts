import { describe, expect, it } from 'vitest'
import { runStateLabel, runStateTone } from './sitrepRuns'
import { sitrepDocxFilename } from './sitrepApi'

describe('runStateLabel', () => {
  it('reads a missed cutoff as Missed, not as a stored failure', () => {
    expect(runStateLabel('not_run')).toBe('Missed')
    expect(runStateLabel('prepared')).toBe('Prepared')
    expect(runStateLabel('failed')).toBe('Failed')
    expect(runStateLabel('pending')).toBe('Pending')
  })
})

describe('runStateTone', () => {
  it('maps each state to a distinct badge tone', () => {
    expect(runStateTone('prepared')).toBe('success')
    expect(runStateTone('failed')).toBe('danger')
    expect(runStateTone('pending')).toBe('info')
    expect(runStateTone('not_run')).toBe('warning')
  })
})

describe('sitrepDocxFilename', () => {
  it('names the export after the frozen revision id', () => {
    expect(sitrepDocxFilename({ id: 42 })).toBe('SITREP-revision-42.docx')
  })
})