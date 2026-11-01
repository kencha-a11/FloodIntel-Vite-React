import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

const form = read('./FloodReportForm.tsx')

function body(marker: string, nextMarker: string): string {
  const start = form.indexOf(marker)
  const end = form.indexOf(nextMarker, start)

  expect(start, `FloodReportForm must still declare ${marker}`).toBeGreaterThan(-1)
  expect(end, `FloodReportForm must still declare ${nextMarker}`).toBeGreaterThan(
    start,
  )

  return form.slice(start, end)
}

/*
 * FR-116 and FR-117: the tag is offered inside the capture flow, is optional,
 * never delays or changes the report, and is not called recorded until the
 * server answers. The client has no DOM test environment (D-103), so the
 * orderings below are pinned at the source, as the queue guards already are.
 */

describe('the tag step inside the capture flow (FR-116, NFR-43)', () => {
  it('renders the step only for a recorder who holds a fix', () => {
    expect(form).toContain('{canRecordTag && gps !== null && (')
    expect(form).toContain('<AccessTagStep')
    expect(form).toContain('draft={tagDraft}')
    expect(form).toContain('options={tagTypes.options}')
    expect(form).toContain('location={formatCoordinates(gps)}')
  })

  it('asks for the published taxonomy with the recorder flag', () => {
    expect(form).toContain('useAccessTagTypes(canRecordTag)')
  })

  it('reuses the report fix and capture instant instead of a second one', () => {
    const record = body('async function recordTag(', 'function applyTagOutcome')

    expect(record).toContain('type: tag.input.type')
    expect(record).toContain('latitude: fix.latitude')
    expect(record).toContain('longitude: fix.longitude')
    expect(record).toContain('gps_accuracy: fix.accuracy')
    expect(record).toContain('observed_at: observedAt')
  })
})

describe('the report answer comes first (FR-116, D-130)', () => {
  it('shows the report result and moves to the success screen before the tag', () => {
    const submit = body('async function handleSubmit(', 'async function recordTag')

    const answered = submit.indexOf('await submitLevelReport(')
    const success = submit.indexOf("setStep('success')")
    const attempt = submit.indexOf('void recordTag(')

    expect(answered).toBeGreaterThan(-1)
    expect(success).toBeGreaterThan(answered)
    expect(attempt).toBeGreaterThan(success)
  })

  it('attempts the tag without awaiting it, so it cannot delay the answer', () => {
    expect(form).toContain('void recordTag(tag, gps, observedAt, attempt)')
    expect(form).not.toContain('await recordTag(')
  })

  it('treats an incomplete draft as skipped rather than blocking the report', () => {
    const validate = body('function validate(', 'function handleReview')

    expect(validate).toContain("setTagErrors(tag.status === 'incomplete'")
    expect(validate).not.toContain('next.tag')
    expect(validate).toContain('return Object.keys(next).length === 0')
  })

  it('states the tag outcome on the success screen only when one applies', () => {
    expect(form).toContain('{submitResult.tag !== null && (')
    expect(form).toContain('{submitResult.tag.message}')
  })

  it('keeps a late tag line off a form the reporter has already reset', () => {
    const apply = body('function applyTagOutcome(', 'function resetForm')

    expect(apply).toContain('if (tagAttempt.current !== attempt)')
    expect(apply).toContain('return')
  })
})

describe('the tag never outlives the capture (FR-117)', () => {
  it('clears the draft and fences the pending attempt on reset', () => {
    const reset = body('function resetForm', 'const photoFieldError')

    expect(reset).toContain('setTagDraft(EMPTY_TAG_DRAFT)')
    expect(reset).toContain('setTagErrors({})')
    expect(reset).toContain('tagAttempt.current += 1')
  })

  it('treats an enabled tag as unsaved work', () => {
    expect(form).toContain('tagDraft.enabled ||')
  })
})

describe('one taxonomy, owned by the server (NFR-42)', () => {
  const SRC = fileURLToPath(new URL('..', import.meta.url))
  const TAXONOMY_VALUES = [
    'narrow_alley',
    'no_vehicle_access',
    'stairs_or_steep',
    'structurally_blocked',
  ]

  interface Source {
    path: string
    source: string
  }

  function sources(directory: string): Source[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name)

      if (entry.isDirectory()) {
        return sources(path)
      }

      if (!/\.tsx?$/.test(entry.name) || /\.test\./.test(entry.name)) {
        return []
      }

      return [{ path, source: readFileSync(path, 'utf8') }]
    })
  }

  it('holds no taxonomy value outside the test fixtures', () => {
    const offenders: string[] = []

    for (const { path, source } of sources(SRC)) {
      for (const value of TAXONOMY_VALUES) {
        if (source.includes(value)) {
          offenders.push(`${path} · ${value}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('reads the labels and the note rule from the published options', () => {
    const step = read('./AccessTagStep.tsx')

    expect(step).toContain('options.map((option) => ({')
    expect(step).toContain('?.requires_note === true')
    expect(step).toContain('label: option.label')
  })
})
