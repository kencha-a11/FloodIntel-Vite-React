import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'
import { BASEMAP_COLORS } from '../styles/tokens'
import type { GeoManifest } from './geoManifest'

export const BASEMAP_ARTIFACTS = [
  'apalit-barangays',
  'apalit-water',
  'apalit-roads',
  'apalit-landmarks',
] as const

export type BasemapArtifact = (typeof BASEMAP_ARTIFACTS)[number]

export type GeoJsonData = FeatureCollection<Geometry, GeoJsonProperties>

export type BasemapLayers = Partial<Record<BasemapArtifact, GeoJsonData>>

export function basemapAttribution(manifest: GeoManifest): string {
  const seen = new Set<string>()
  const lines: string[] = []

  for (const artifact of manifest.artifacts) {
    if (!BASEMAP_ARTIFACTS.includes(artifact.name as BasemapArtifact)) {
      continue
    }

    if (seen.has(artifact.attribution)) {
      continue
    }

    seen.add(artifact.attribution)
    lines.push(artifact.attribution)
  }

  return lines.join(' · ')
}

export function basemapVersionLabel(manifest: GeoManifest): string {
  return `Release ${manifest.release} · basemap as of ${manifest.generated_at.slice(0, 10)}`
}

export function buildBasemapStyle(
  layers: BasemapLayers,
  attribution: string,
): StyleSpecification {
  const sources: StyleSpecification['sources'] = {}

  if (layers['apalit-barangays'] !== undefined) {
    sources['apalit-barangays'] = {
      type: 'geojson',
      data: layers['apalit-barangays'],
      attribution,
    }
  }

  if (layers['apalit-water'] !== undefined) {
    sources['apalit-water'] = {
      type: 'geojson',
      data: layers['apalit-water'],
      attribution,
    }
  }

  if (layers['apalit-roads'] !== undefined) {
    sources['apalit-roads'] = {
      type: 'geojson',
      data: layers['apalit-roads'],
      attribution,
    }
  }

  if (layers['apalit-landmarks'] !== undefined) {
    sources['apalit-landmarks'] = {
      type: 'geojson',
      data: layers['apalit-landmarks'],
      attribution,
    }
  }

  const styleLayers: LayerSpecification[] = [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': BASEMAP_COLORS.background },
    },
  ]

  if (sources['apalit-barangays'] !== undefined) {
    styleLayers.push({
      id: 'barangay-fill',
      type: 'fill',
      source: 'apalit-barangays',
      paint: { 'fill-color': BASEMAP_COLORS.barangayFill, 'fill-opacity': 0.45 },
    })
  }

  if (sources['apalit-water'] !== undefined) {
    styleLayers.push({
      id: 'water-fill',
      type: 'fill',
      source: 'apalit-water',
      paint: { 'fill-color': BASEMAP_COLORS.waterFill, 'fill-opacity': 0.9 },
    })
  }

  if (sources['apalit-roads'] !== undefined) {
    styleLayers.push({
      id: 'roads-line',
      type: 'line',
      source: 'apalit-roads',
      paint: {
        'line-color': BASEMAP_COLORS.road,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 15, 2],
      },
    })
  }

  if (sources['apalit-barangays'] !== undefined) {
    styleLayers.push({
      id: 'barangay-boundary',
      type: 'line',
      source: 'apalit-barangays',
      paint: { 'line-color': BASEMAP_COLORS.boundary, 'line-width': 1.2 },
    })
  }

  if (sources['apalit-landmarks'] !== undefined) {
    styleLayers.push({
      id: 'landmarks-circle',
      type: 'circle',
      source: 'apalit-landmarks',
      paint: {
        'circle-color': BASEMAP_COLORS.landmark,
        'circle-radius': 3,
        'circle-stroke-color': BASEMAP_COLORS.landmarkStroke,
        'circle-stroke-width': 1,
      },
    })
  }

  return {
    version: 8,
    name: 'Apalit basemap',
    sources,
    layers: styleLayers,
  }
}
