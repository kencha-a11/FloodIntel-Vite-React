import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * The client runs vitest in a Node environment with no DOM and no WebGL, so a
 * MapLibre mount cannot be asserted here. These guards pin the seams the
 * browser runs then prove: the detail loads its section lazily, the section
 * delegates the map to the one shared pin map, the elevation is labeled
 * Derived, the view states its degraded state, and both lazy map chunks are
 * excluded from the precache while remaining runtime-cached (offline base
 * layers, NFR-02).
 */

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

const detail = read('../components/ReportDetail.tsx')
const section = read('../components/ReportLocationMap.tsx')
const pinMap = read('../components/LocationPinMap.tsx')
const mapRuntime = read('../lib/mapRuntime.ts')
const viteConfig = read('../../vite.config.ts')

describe('report detail location map', () => {
  it('loads the section as its own chunk inside the detail', () => {
    expect(detail).toContain("lazy(() => import('./ReportLocationMap'))")
    expect(detail).toContain('<Suspense')
    expect(detail).toContain('<ReportLocationMap report={report} />')
  })

  it('delegates the map to the one shared pin map', () => {
    expect(section).toContain("from './LocationPinMap'")
    expect(section).toContain('<LocationPinMap')
    expect(section).toContain('label="Report location map"')
    // No second map implementation in the section.
    expect(section).not.toContain('maplibregl')
  })

  it('reuses the verified manifest, style, and map runtime seams', () => {
    expect(pinMap).toContain('loadGeoManifest')
    expect(pinMap).toContain('fetchGeoJson')
    expect(pinMap).toContain('buildBasemapStyle')
    expect(pinMap).toContain('basemapAttribution')
    expect(pinMap).toContain("from '../lib/mapRuntime'")
    expect(mapRuntime).toContain('maplibregl.setWorkerUrl(maplibreWorkerUrl)')
    // No second artifact path: the manifest loader owns fetching and checksums.
    expect(pinMap).not.toMatch(/\bfetch\(/)
  })

  it('labels the ground elevation Derived and states its method', () => {
    expect(section).toContain('DATA_SOURCE_LABELS.derived')
    expect(section).toContain('describeGroundElevation')
    expect(section).toContain('loadElevationSampler')
  })

  it('states the degraded state instead of an empty map', () => {
    expect(pinMap).toContain('The map could not be drawn')
    expect(pinMap).toContain('The position and address')
    expect(pinMap).toContain('Basemap unavailable')
    expect(section).toContain('report-location-facts')
  })
})

describe('detail map chunk caching', () => {
  it('keeps the lazy map chunks out of the precache', () => {
    expect(viteConfig).toContain("'**/ReportLocationMap-*.js'")
    expect(viteConfig).toContain("'**/LocationPinMap-*.js'")
    expect(viteConfig).toContain("'**/mapStyle-*.js'")
    expect(viteConfig).toContain("'**/maplibre-gl-*.js'")
  })

  it('runtime-caches the lazy map chunks with the map runtime', () => {
    expect(viteConfig).toContain(
      '(?:MapView-|ReportLocationMap-|LocationPinMap-|mapStyle-|maplibre-gl-)',
    )
  })
})
