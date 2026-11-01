import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

const form = read('./FloodReportForm.tsx')

/*
 * The client has no DOM test environment (D-103), so the form's wiring is
 * pinned at the source, as the queue's retention guards already are.
 */

describe('capture messages are tied to their fields (design §8)', () => {
  it('names the location group and describes it with the fix or the error', () => {
    expect(form).toContain('role="group"')
    expect(form).toContain('aria-labelledby="report-location-label"')
    expect(form).toContain('id="report-location-label"')
    expect(form).toContain(
      "aria-describedby={locationMessage === null ? undefined : 'report-location-error'}",
    )
    expect(form).toContain('aria-invalid={locationMessage === null ? undefined : true}')
    expect(form).toContain('id="report-location-error"')
  })

  it('names the photo group and describes it with the capture error', () => {
    expect(form).toContain('aria-labelledby="report-photo-label"')
    expect(form).toContain('id="report-photo-label"')
    expect(form).toContain(
      "aria-describedby={photoMessage === null ? undefined : 'report-photo-error'}",
    )
    expect(form).toContain('aria-invalid={photoMessage === null ? undefined : true}')
    expect(form).toContain('id="report-photo-error"')
  })

  it('keeps the GPS acquisition failure announced', () => {
    expect(form).toContain('<Alert tone="danger" id="report-location-error">')
  })

  it('hands the photo field the same words the camera shows', () => {
    const camera = read('./CameraCapture.tsx')

    expect(camera).not.toContain('onError(message)')
    expect(camera).toContain('onError(reason)')
  })
})

describe('confirmation (design §9)', () => {
  it('names the flood type through the shared vocabulary', () => {
    expect(form).toContain('floodTypeLabel(floodType)')
    expect(form).not.toContain('<dd>{floodType}</dd>')
  })
})

describe('reset', () => {
  it('clears the previous capture so the next report cannot show it', () => {
    const start = form.indexOf('function resetForm')
    const reset = form.slice(start, form.indexOf('const photoFieldError', start))

    expect(start).toBeGreaterThan(-1)
    expect(reset).toContain('setGps(null)')
    expect(reset).toContain('refreshLocation()')
  })
})
