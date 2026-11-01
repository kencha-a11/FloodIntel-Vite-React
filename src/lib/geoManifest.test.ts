import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearGeoCache,
  fetchGeoArtifact,
  GeoArtifactError,
  loadGeoManifest,
  resolveArtifactUrl,
  type GeoArtifact,
  type GeoManifest,
} from './geoManifest'

const PAYLOAD = new TextEncoder().encode('{"type":"FeatureCollection","features":[]}')
const PAYLOAD_SHA256 = 'ed778c73ea51338d6576fb5992b189f2b94d9f3d5e199f46c1af520d6b0b3e6c'

const artifact: GeoArtifact = {
  name: 'apalit-barangays',
  path: '/geo/apalit-barangays.geojson',
  format: 'geojson',
  sha256: PAYLOAD_SHA256,
  bytes: PAYLOAD.byteLength,
  feature_count: 12,
  source: 'PSA/NAMRIA ADM4',
  vintage: '2023-11-06',
  license: { id: 'CC-BY-IGO', name: 'CC BY-IGO', url: 'https://example.test' },
  attribution: 'PSA and NAMRIA',
  derived: false,
}

function buildManifest(overrides: Partial<GeoManifest> = {}): GeoManifest {
  return {
    manifest_version: 1,
    dataset: 'apalit-geo',
    release: '2026.10.31-1',
    generated_at: '2026-10-31T00:00:00Z',
    crs: 'EPSG:4326',
    axis_order: 'longitude,latitude',
    coordinate_precision: 7,
    generator: { command: 'python tools/geo/build_geo.py', inputs: [] },
    artifacts: [artifact],
    blocked: [
      {
        name: 'apalit-dem',
        staged_path: 'tools/geo/dist/2026.10.31-1/apalit-dem.bin',
        sha256: '0'.repeat(64),
        reason: 'license-unrecorded',
        detail: 'attribution not recorded',
        license: { status: 'unrecorded' },
      },
    ],
    interior_fill: { count: 0, artifact: 'apalit-dem-derived' },
    warnings: [],
    ...overrides,
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('resolveArtifactUrl', () => {
  it('joins the served file to the base URL', () => {
    expect(resolveArtifactUrl(artifact)).toBe('/geo/apalit-barangays.geojson')
    expect(resolveArtifactUrl(artifact, '/static/geo/')).toBe(
      '/static/geo/apalit-barangays.geojson',
    )
  })
})

describe('loadGeoManifest', () => {
  beforeEach(() => clearGeoCache())
  afterEach(() => vi.unstubAllGlobals())

  it('loads and caches the manifest', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(buildManifest()))
    vi.stubGlobal('fetch', fetchMock)

    const first = await loadGeoManifest()
    const second = await loadGeoManifest()

    expect(first.release).toBe('2026.10.31-1')
    expect(second).toBe(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fails closed when the manifest is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })))

    await expect(loadGeoManifest()).rejects.toMatchObject({
      code: 'manifest-unavailable',
    })
  })

  it('fails closed on an unknown manifest version', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(buildManifest({ manifest_version: 2 }))),
    )

    await expect(loadGeoManifest()).rejects.toBeInstanceOf(GeoArtifactError)
  })
})

describe('fetchGeoArtifact', () => {
  beforeEach(() => clearGeoCache())
  afterEach(() => vi.unstubAllGlobals())

  it('returns bytes whose checksum matches the manifest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(PAYLOAD)))

    const result = await fetchGeoArtifact(buildManifest(), 'apalit-barangays')

    expect(result.artifact).toBe(artifact)
    expect(new TextDecoder().decode(result.bytes)).toBe(new TextDecoder().decode(PAYLOAD))
  })

  it('rejects bytes that do not match the recorded checksum', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(new TextEncoder().encode('tampered'))),
    )

    await expect(fetchGeoArtifact(buildManifest(), 'apalit-barangays')).rejects.toMatchObject({
      code: 'checksum-mismatch',
    })
  })

  it('refuses an artifact the manifest withholds', async () => {
    vi.stubGlobal('fetch', vi.fn())

    await expect(fetchGeoArtifact(buildManifest(), 'apalit-dem')).rejects.toMatchObject({
      code: 'artifact-blocked',
    })
  })

  it('refuses a name the manifest does not list', async () => {
    vi.stubGlobal('fetch', vi.fn())

    await expect(fetchGeoArtifact(buildManifest(), 'apalit-unknown')).rejects.toMatchObject({
      code: 'artifact-missing',
    })
  })
})
