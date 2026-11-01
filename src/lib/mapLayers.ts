import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { MAP_ALERT_TIERS, MAP_DERIVED, MAP_TERRAIN } from '../styles/tokens'
import type { MapTierStyle } from '../styles/tokens'
import type { AlertLevel, ValidatedFeedRow } from '../types/report'
import type { ElevationSampler } from './elevation'
import { DATA_SOURCE_LABELS } from './vocabulary'

export const ALERT_TIER_STYLES: Record<AlertLevel, MapTierStyle> = MAP_ALERT_TIERS

export const TIER_ORDER: AlertLevel[] = ['alert', 'get_ready', 'red_alert']

// Kept apart from ALERT_TIER_STYLES so no computed surface can borrow an alert
// color (NFR-24, D-27).
export const DERIVED_STYLE = MAP_DERIVED

export type FeedPoint = { row: ValidatedFeedRow; lon: number; lat: number }

export function feedPoints(rows: ValidatedFeedRow[]): FeedPoint[] {
  return rows
    .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude))
    .map((row) => ({ row, lon: row.longitude, lat: row.latitude }))
}

export function highestTier(rows: ValidatedFeedRow[]): AlertLevel | null {
  let highest: AlertLevel | null = null

  for (const row of rows) {
    if (highest === null || ALERT_TIER_STYLES[row.alert_level].tier > ALERT_TIER_STYLES[highest].tier) {
      highest = row.alert_level
    }
  }

  return highest
}

export type MapMarker =
  | { kind: 'point'; id: string; lon: number; lat: number; row: ValidatedFeedRow }
  | {
      kind: 'cluster'
      id: string
      lon: number
      lat: number
      count: number
      tier: AlertLevel
      rows: ValidatedFeedRow[]
    }

// Grid size in degrees at zoom 12; each zoom level halves it.
export function cellSizeForZoom(zoom: number): number {
  const clamped = Math.max(0, Math.min(8, zoom - 12))

  return Math.max(1e-4, 0.02 / 2 ** clamped)
}

export function clusterMarkers(points: FeedPoint[], cellDegrees: number): MapMarker[] {
  const cell = Math.max(cellDegrees, 1e-6)
  const groups = new Map<string, FeedPoint[]>()

  for (const point of points) {
    const key = `${Math.floor(point.lat / cell)}:${Math.floor(point.lon / cell)}`
    const group = groups.get(key)

    if (group === undefined) {
      groups.set(key, [point])
    } else {
      group.push(point)
    }
  }

  const markers: MapMarker[] = []

  for (const group of groups.values()) {
    if (group.length === 1) {
      const { row, lon, lat } = group[0]

      markers.push({ kind: 'point', id: `p-${row.id}`, lon, lat, row })
      continue
    }

    // Sum in id order so the centroid does not drift with input order.
    const ordered = [...group].sort((a, b) => a.row.id - b.row.id)
    const rows = ordered.map((point) => point.row)
    const lon = ordered.reduce((sum, point) => sum + point.lon, 0) / ordered.length
    const lat = ordered.reduce((sum, point) => sum + point.lat, 0) / ordered.length
    const tier = highestTier(rows)

    if (tier === null) {
      continue
    }

    markers.push({
      kind: 'cluster',
      id: `c-${rows[0].id}-${rows.length}`,
      lon,
      lat,
      count: rows.length,
      tier,
      rows,
    })
  }

  return markers.sort((a, b) => {
    if (a.lat !== b.lat) {
      return b.lat - a.lat
    }

    if (a.lon !== b.lon) {
      return a.lon - b.lon
    }

    return a.id.localeCompare(b.id)
  })
}

export type ElevationBand = {
  band: string
  min_m: number
  max_m: number
  brgy_code: string
}

export type BandFeature = Feature<Geometry, ElevationBand>

export type BandCollection = FeatureCollection<Geometry, ElevationBand>

export type SurfaceExclusionReason =
  | 'depth_not_recorded'
  | 'elevation_unknown'
  | 'barangay_uncovered'
  | 'no_band_below_threshold'

export type SurfaceDriver = {
  reportId: number
  barangayId: number
  barangayCode: string
  observedAt: string
  baseElevationM: number
  depthCm: number
  waterSurfaceM: number
  derivedCell: boolean
}

export type SurfaceExclusion = { reportId: number; reason: SurfaceExclusionReason }

export type SurfaceResult = {
  features: BandFeature[]
  drivers: SurfaceDriver[]
  excluded: SurfaceExclusion[]
  bandLabels: string[]
  absent: boolean
}

const EPSILON = 1e-9

// D-78: the latest validated report in each barangay drives that barangay's
// threshold; bands are selected when their max_m is at or below it.
export function selectInundationSurface(
  rows: ValidatedFeedRow[],
  features: BandFeature[],
  sampler: Pick<ElevationSampler, 'sample'>,
  barangayCodeById: Map<number, string>,
): SurfaceResult {
  const driversByBarangay = new Map<number, ValidatedFeedRow>()

  for (const row of rows) {
    const current = driversByBarangay.get(row.barangay.id)

    if (
      current === undefined ||
      row.observed_at > current.observed_at ||
      (row.observed_at === current.observed_at && row.id > current.id)
    ) {
      driversByBarangay.set(row.barangay.id, row)
    }
  }

  const drivers: SurfaceDriver[] = []
  const excluded: SurfaceExclusion[] = []
  const selected = new Map<string, BandFeature>()

  for (const row of driversByBarangay.values()) {
    const code = barangayCodeById.get(row.barangay.id)

    if (code === undefined) {
      excluded.push({ reportId: row.id, reason: 'barangay_uncovered' })
      continue
    }

    if (!isRecordedDepth(row)) {
      excluded.push({ reportId: row.id, reason: 'depth_not_recorded' })
      continue
    }

    const sample = sampler.sample(row.longitude, row.latitude)

    if (sample.elevationM === null) {
      excluded.push({ reportId: row.id, reason: 'elevation_unknown' })
      continue
    }

    const waterSurfaceM = sample.elevationM + row.depth_cm / 100
    const bands = features.filter(
      (feature) =>
        feature.properties.brgy_code === code &&
        feature.properties.max_m <= waterSurfaceM + EPSILON,
    )

    if (bands.length === 0) {
      excluded.push({ reportId: row.id, reason: 'no_band_below_threshold' })
      continue
    }

    for (const band of bands) {
      selected.set(`${band.properties.brgy_code}:${band.properties.band}`, band)
    }

    drivers.push({
      reportId: row.id,
      barangayId: row.barangay.id,
      barangayCode: code,
      observedAt: row.observed_at,
      baseElevationM: sample.elevationM,
      depthCm: row.depth_cm,
      waterSurfaceM,
      derivedCell: sample.derived,
    })
  }

  const selectedFeatures = [...selected.values()].sort((a, b) => {
    if (a.properties.brgy_code !== b.properties.brgy_code) {
      return a.properties.brgy_code.localeCompare(b.properties.brgy_code)
    }

    return a.properties.min_m - b.properties.min_m
  })

  const bandLabels = [...new Set(selectedFeatures.map((feature) => feature.properties.band))].sort(
    (a, b) => {
      const featureA = selectedFeatures.find((feature) => feature.properties.band === a)
      const featureB = selectedFeatures.find((feature) => feature.properties.band === b)

      return (featureA?.properties.min_m ?? 0) - (featureB?.properties.min_m ?? 0)
    },
  )

  return {
    features: selectedFeatures,
    drivers,
    excluded,
    bandLabels,
    absent: selectedFeatures.length === 0,
  }
}

export function surfaceFeatureCollection(
  result: SurfaceResult,
): FeatureCollection<Geometry, ElevationBand> {
  return { type: 'FeatureCollection', features: result.features }
}

function isRecordedDepth(
  row: ValidatedFeedRow,
): row is ValidatedFeedRow & { depth_cm: number } {
  return typeof row.depth_cm === 'number' && Number.isFinite(row.depth_cm) && row.depth_cm > 0
}

export function describeSurface(result: SurfaceResult): {
  state: 'present' | 'absent'
  headline: string
  detail: string
} {
  if (!result.absent) {
    const highest = Math.max(...result.drivers.map((driver) => driver.waterSurfaceM))
    const barangays = new Set(result.drivers.map((driver) => driver.barangayCode)).size
    const derivedCells = result.drivers.filter((driver) => driver.derivedCell).length
    const sampled = result.drivers
      .map((driver) => `report #${driver.reportId} at ${driver.baseElevationM.toFixed(2)} m + ${driver.depthCm} cm`)
      .join('; ')

    return {
      state: 'present',
      headline: `${DATA_SOURCE_LABELS.derived} · inundation below ${highest.toFixed(2)} m`,
      detail: `${barangays} barangay${barangays === 1 ? '' : 's'}, ${result.bandLabels.length} band${
        result.bandLabels.length === 1 ? '' : 's'
      } (${result.bandLabels.join(', ')}). Method: DEM(report point) + reported depth, bands selected at or below the threshold. ${sampled}${
        derivedCells > 0 ? `; ${derivedCells} of ${result.drivers.length} sampled cells are interpolated` : ''
      }.`,
    }
  }

  if (result.excluded.some((exclusion) => exclusion.reason === 'depth_not_recorded')) {
    return {
      state: 'absent',
      headline: `${DATA_SOURCE_LABELS.derived} surface: depth not recorded`,
      detail:
        'The latest validated report in at least one barangay carries no numeric depth, so no inundation surface is drawn (D-78). Depth is never inferred from the alert tier.',
    }
  }

  return {
    state: 'absent',
    headline: `${DATA_SOURCE_LABELS.derived} surface: not available`,
    detail:
      result.excluded.length === 0
        ? 'No validated report is in view, so there is no depth to compose a surface from.'
        : `No extent was drawn: ${result.excluded
            .map((exclusion) => `report #${exclusion.reportId} (${describeExclusion(exclusion.reason)})`)
            .join(', ')}.`,
  }
}

export function describeExclusion(reason: SurfaceExclusionReason): string {
  switch (reason) {
    case 'depth_not_recorded':
      return 'depth not recorded'
    case 'elevation_unknown':
      return 'elevation not in the DEM'
    case 'barangay_uncovered':
      return 'barangay has no boundaries in this release'
    case 'no_band_below_threshold':
      return 'threshold below every band'
  }
}

/* ------------------------------------------------------------------------ *
 * Terrain elevation (FR-54) — all bands, off by default, its own treatment.
 * ------------------------------------------------------------------------ */

export type LayerId = 'reported' | 'inundation' | 'terrain'

export type LayerVisibility = Record<LayerId, boolean>

// FR-54/FR-55: a derived layer is off by default until its legend exists;
// terrain ships with its legend, so it starts off, and the other two start on.
export const DEFAULT_LAYERS: LayerVisibility = {
  reported: true,
  inundation: true,
  terrain: false,
}

export type TerrainBandRange = { color: string; label: string }

// The ramp is documented by numbers, not by hue alone (NFR-22).
export function terrainRanges(breaks: readonly number[] = MAP_TERRAIN.breaks): TerrainBandRange[] {
  return MAP_TERRAIN.colors.map((color, index) => {
    const lower = index === 0 ? null : breaks[index - 1]
    const upper = index === breaks.length ? null : breaks[index]

    if (lower === null && upper !== null) {
      return { color, label: `below ${upper} m` }
    }

    if (lower !== null && upper === null) {
      return { color, label: `${lower} m and above` }
    }

    return { color, label: `${lower}–${upper} m` }
  })
}

/**
 * MapLibre `step` over the band's floor elevation. Kept as a data expression
 * so the palette stays in the token mirror and out of the component (NFR-24).
 */
export function terrainFillPaint(): Record<string, unknown> {
  const stops: unknown[] = []

  MAP_TERRAIN.breaks.forEach((breakValue, index) => {
    stops.push(breakValue, MAP_TERRAIN.colors[index + 1])
  })

  return {
    'fill-color': ['step', ['get', 'min_m'], MAP_TERRAIN.colors[0], ...stops],
    'fill-opacity': MAP_TERRAIN.fillOpacity,
    'fill-outline-color': MAP_TERRAIN.line,
  }
}

export function terrainLinePaint(): Record<string, unknown> {
  return { 'line-color': MAP_TERRAIN.line, 'line-width': 0.6, 'line-opacity': 0.85 }
}

export function terrainBandStats(features: BandFeature[]): {
  bandCount: number
  barangayCount: number
  minM: number
  maxM: number
} | null {
  if (features.length === 0) {
    return null
  }

  let minM = Number.POSITIVE_INFINITY
  let maxM = Number.NEGATIVE_INFINITY

  for (const feature of features) {
    minM = Math.min(minM, feature.properties.min_m)
    maxM = Math.max(maxM, feature.properties.max_m)
  }

  return {
    bandCount: features.length,
    barangayCount: new Set(features.map((feature) => feature.properties.brgy_code)).size,
    minM,
    maxM,
  }
}

/**
 * The vertical accuracy has no source: release 2026.10.31-1 records no accuracy
 * field, so the legend discloses the gap instead of stating a figure (NFR-15).
 */
export const TERRAIN_VERTICAL_ACCURACY_NOTE =
  'vertical accuracy not recorded for the supplied Copernicus extract (vintage also unknown)'

export function describeTerrain(
  features: BandFeature[],
  cellSize: string | null,
): { headline: string; detail: string; ranges: TerrainBandRange[] } | null {
  const stats = terrainBandStats(features)

  if (stats === null) {
    return null
  }

  const detail = [
    `${stats.bandCount} bands in ${stats.barangayCount} barangays, ${stats.minM.toFixed(2)}–${stats.maxM.toFixed(2)} m orthometric.`,
    'Method: every elevation band the DEM yields for a barangay, classified by the band floor.',
    cellSize === null ? 'Cell size unavailable.' : `Cell size ${cellSize}.`,
    TERRAIN_VERTICAL_ACCURACY_NOTE + '.',
    'Source: Copernicus DEM GLO-30 (COPDEM-30). Derived — not an observation.',
  ].join(' ')

  return {
    headline: `${DATA_SOURCE_LABELS.derived} · terrain elevation`,
    detail,
    ranges: terrainRanges(),
  }
}

