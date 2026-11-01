import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * The client runs vitest in a Node environment with no DOM and no WebGL, so a
 * MapLibre mount cannot be asserted here. These guards pin the seams the
 * browser run then proves: the detail loads the map lazily, the map reuses the
 * shared manifest/style/elevation modules rather than a second fetch path, the
 * elevation is labeled Derived, the view states its degraded state, and the
 * lazy chunk is excluded from the precache while remaining runtime-cached
 * (offline base layers, NFR-02).
 */

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

const detail = read('../components/ReportDetail.tsx')
const map = read('../components/ReportLocationMap.tsx')
const mapRuntime = read('../lib/mapRuntime.ts')
const viteConfig = read('../../vite.config.ts')

describe('report detail location map', () => {
  it('loads the map as its own chunk inside the detail', () => {
    expect(detail).toContain("lazy(() => import('./ReportLocationMap'))")
    expect(detail).toContain('<Suspense')
    expect(detail).toContain('<ReportLocationMap report={report} />')
  })

  it('reuses the verified manifest, style, and elevation seams', () => {
    expect(map).toContain('loadGeoManifest')
    expect(map).toContain('fetchGeoJson')
    expect(map).toContain('buildBasemapStyle')
    expect(map).toContain('basemapAttribution')
    expect(map).toContain('loadElevationSampler')
    expect(map).toContain("from '../lib/mapRuntime'")
    expect(mapRuntime).toContain('maplibregl.setWorkerUrl(maplibreWorkerUrl)')
    // No second artifact path: the manifest loader owns fetching and checksums.
    expect(map).not.toMatch(/\bfetch\(/)
  })

  it('labels the ground elevation Derived and states its method', () => {
    expect(map).toContain('DATA_SOURCE_LABELS.derived')
    expect(map).toContain('describeGroundElevation')
  })

  it('states the degraded state instead of an empty map', () => {
    expect(map).toContain('The map could not be drawn')
    expect(map).toContain('The position and address')
    expect(map).toContain('report-location-facts')
    expect(map).toContain('Basemap unavailable')
  })
})

describe('detail map chunk caching', () => {
  it('keeps the lazy map chunks out of the precache', () => {
    expect(viteConfig).toContain("'**/ReportLocationMap-*.js'")
    expect(viteConfig).toContain("'**/mapStyle-*.js'")
    expect(viteConfig).toContain("'**/maplibre-gl-*.js'")
  })

  it('runtime-caches the detail chunk with the map runtime', () => {
    expect(viteConfig).toContain(
      '(?:MapView-|ReportLocationMap-|mapStyle-|maplibre-gl-)',
    )
  })
})
