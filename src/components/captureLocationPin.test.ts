import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * FR-05 asks the form to capture the location as a map pin. The client runs
 * vitest without a DOM or WebGL, so these guards pin what the browser run then
 * proves: the capture form loads the pin map lazily and only once a fix
 * exists, the text readout survives so the location is never map-only, and the
 * pin cannot be moved — FR-05 pairs it with auto-captured GPS and NFR-05
 * freezes that fix after capture (D-115).
 */

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

const form = read('../components/FloodReportForm.tsx')
const pinMap = read('../components/LocationPinMap.tsx')

describe('capture location pin', () => {
  it('loads the pin map lazily, not into the capture bundle', () => {
    expect(form).toContain("lazy(() => import('./LocationPinMap'))")
    expect(form).toContain('<Suspense fallback={<p className="muted">Loading map…</p>}>')
    expect(form).not.toContain('maplibre-gl')
    expect(form).not.toContain('mapRuntime')
  })

  it('draws the pin only against an acquired fix', () => {
    expect(form).toContain('{gps !== null && !isLocating && (')
    expect(form).toContain('latitude={gps.latitude}')
    expect(form).toContain('longitude={gps.longitude}')
    expect(form).toContain('accuracy={gps.accuracy}')
    expect(form).toContain('label="Map pin for this report"')
  })

  it('keeps the coordinates and accuracy as text beside the map', () => {
    expect(form).toContain('formatCoordinates(gps)')
    expect(form).toContain('formatAccuracy(gps.accuracy)')
    expect(form).toContain('describeAddressStatus(addressStatus, address)')
  })

  it('never turns the pin into a picker', () => {
    expect(pinMap).not.toContain('draggable')
    expect(pinMap).not.toContain('onDragEnd')
    expect(pinMap).not.toContain('click')
    expect(pinMap).toContain('.setLngLat(center)')
  })
})
