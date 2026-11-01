import type { Feature, Polygon } from 'geojson'
import type { ElevationSample } from './elevation'
import { DATA_SOURCE_LABELS } from './vocabulary'

const EARTH_RADIUS_M = 6_371_008.8
const DEM_SOURCE = 'Source: Copernicus DEM GLO-30 (COPDEM-30).'

export type LonLat = [number, number]

export type GroundElevationReadout = {
  value: string
  note: string
}

function destinationPoint(center: LonLat, bearing: number, distanceM: number): LonLat {
  const angular = distanceM / EARTH_RADIUS_M
  const latRad = (center[1] * Math.PI) / 180
  const lonRad = (center[0] * Math.PI) / 180
  const lat2 = Math.asin(
    Math.sin(latRad) * Math.cos(angular) +
      Math.cos(latRad) * Math.sin(angular) * Math.cos(bearing),
  )
  const lon2 =
    lonRad +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(latRad),
      Math.cos(angular) - Math.sin(latRad) * Math.sin(lat2),
    )

  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]
}

/**
 * The accuracy radius as a ground-true polygon. MapLibre's circle radius is in
 * pixels, so a ground radius needs geometry that scales with the map (FR-51).
 * Returns null when the device recorded no usable accuracy: a zero radius would
 * draw a ring that says nothing.
 */
export function accuracyRing(
  center: LonLat,
  accuracyM: number | null,
  steps = 64,
): Feature<Polygon> | null {
  if (accuracyM === null || !Number.isFinite(accuracyM) || accuracyM <= 0) {
    return null
  }

  const ring: LonLat[] = []

  for (let index = 0; index <= steps; index += 1) {
    ring.push(destinationPoint(center, (index / steps) * 2 * Math.PI, accuracyM))
  }

  return {
    type: 'Feature',
    properties: null,
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
}

export function ringBounds(
  ring: Feature<Polygon>,
): [[number, number], [number, number]] {
  const points = ring.geometry.coordinates[0]
  const lngs = points.map((point) => point[0])
  const lats = points.map((point) => point[1])

  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

export function describeAccuracy(accuracyM: number | null): string {
  if (accuracyM === null || !Number.isFinite(accuracyM)) {
    return 'Not recorded'
  }

  return `±${Math.round(accuracyM)} m`
}

export function describeGroundElevation(
  sample: ElevationSample,
  cellSize: string | null,
): GroundElevationReadout {
  const cell =
    cellSize === null ? '' : `, ${cellSize}`

  if (sample.elevationM === null) {
    return {
      value: 'Not recorded at this point',
      note: `${DATA_SOURCE_LABELS.derived} · the DEM has no value at this coordinate (nodata or outside the supplied extract). ${DEM_SOURCE}`,
    }
  }

  return {
    value: `${sample.elevationM.toFixed(2)} m`,
    note: `${DATA_SOURCE_LABELS.derived} · sampled at the report point from the nearest DEM cell${
      sample.derived ? ' (an interpolated cell)' : ''
    }${cell}. ${DEM_SOURCE}`,
  }
}
