import { describe, expect, it } from 'vitest'
import {
  basemapAttribution,
  basemapVersionLabel,
  buildBasemapStyle,
} from './mapStyle'
import type { BasemapLayers, GeoJsonData } from './mapStyle'
import type { GeoArtifact, GeoManifest } from './geoManifest'

const PSA = '© Philippine Statistics Authority (PSA) and National Mapping and Resource Information Authority (NAMRIA), Philippines COD-AB, CC BY-IGO'
const OSM = '© OpenStreetMap contributors'

function artifact(name: string, attribution: string): GeoArtifact {
  return {
    name,
    path: `/geo/${name}.geojson`,
    format: 'geojson',
    sha256: 'a'.repeat(64),
    bytes: 1,
    source: 'test',
    vintage: '2026-10-31',
    license: { id: 'test', name: 'test', url: 'https://example.test' },
    attribution,
    derived: false,
  }
}

function manifest(artifacts: GeoArtifact[]): GeoManifest {
  return {
    manifest_version: 1,
    dataset: 'apalit-geo',
    release: '2026.10.31-1',
    generated_at: '2026-10-31T03:04:45Z',
    crs: 'EPSG:4326',
    axis_order: 'longitude,latitude',
    coordinate_precision: 7,
    generator: { command: 'test', inputs: [] },
    artifacts,
    blocked: [],
    interior_fill: { count: 0, artifact: 'apalit-dem-derived' },
    warnings: [],
  }
}

function collection(): GeoJsonData {
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [120.8, 14.95] } },
    ],
  }
}

describe('basemapAttribution', () => {
  it('keeps each distinct attribution once', () => {
    const text = basemapAttribution(
      manifest([
        artifact('apalit-barangays', PSA),
        artifact('apalit-water', OSM),
        artifact('apalit-roads', OSM),
        artifact('apalit-landmarks', OSM),
        artifact('apalit-dem', 'Copernicus DEM'),
      ]),
    )

    expect(text).toBe(`${PSA} · ${OSM}`)
  })

  it('omits artifacts that are not part of the basemap', () => {
    expect(basemapAttribution(manifest([artifact('apalit-dem', 'Copernicus DEM')]))).toBe('')
  })
})

describe('basemapVersionLabel', () => {
  it('names the release and its date', () => {
    expect(basemapVersionLabel(manifest([]))).toBe(
      'Release 2026.10.31-1 · basemap as of 2026-10-31',
    )
  })
})

describe('buildBasemapStyle', () => {
  it('builds every layer from the supplied collections', () => {
    const layers: BasemapLayers = {
      'apalit-barangays': collection(),
      'apalit-water': collection(),
      'apalit-roads': collection(),
      'apalit-landmarks': collection(),
    }

    const style = buildBasemapStyle(layers, OSM)

    expect(Object.keys(style.sources)).toEqual([
      'apalit-barangays',
      'apalit-water',
      'apalit-roads',
      'apalit-landmarks',
    ])
    expect(style.layers?.map((layer) => layer.id)).toEqual([
      'background',
      'barangay-fill',
      'water-fill',
      'roads-line',
      'barangay-boundary',
      'landmarks-circle',
    ])
    expect(style.layers?.length).toBe(6)
    expect(style.glyphs).toBeUndefined()
    expect(style.sprite).toBeUndefined()

    const source = style.sources['apalit-barangays']

    if (source.type !== 'geojson') {
      throw new Error('expected a geojson source')
    }

    expect(source.data).toBe(layers['apalit-barangays'])
    expect(source.attribution).toBe(OSM)
  })

  it('omits a layer whose artifact is unavailable', () => {
    const style = buildBasemapStyle(
      { 'apalit-barangays': collection() },
      PSA,
    )

    expect(Object.keys(style.sources)).toEqual(['apalit-barangays'])
    expect(style.layers?.map((layer) => layer.id)).toEqual([
      'background',
      'barangay-fill',
      'barangay-boundary',
    ])
  })
})
