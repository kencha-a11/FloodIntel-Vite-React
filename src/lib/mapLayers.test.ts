import type { Geometry } from 'geojson'
import { describe, expect, it } from 'vitest'
import {
  ALERT_TIER_STYLES,
  DEFAULT_LAYERS,
  DERIVED_STYLE,
  cellSizeForZoom,
  clusterMarkers,
  describeSurface,
  describeTerrain,
  feedPoints,
  highestTier,
  selectInundationSurface,
  surfaceFeatureCollection,
  terrainBandStats,
  terrainFillPaint,
  terrainLinePaint,
  terrainRanges,
} from './mapLayers'
import type { BandFeature, SurfaceResult } from './mapLayers'
import { MAP_TERRAIN } from '../styles/tokens'
import type { ValidatedFeedRow } from '../types/report'

const SQUARE: Geometry = {
  type: 'Polygon',
  coordinates: [
    [
      [120.79, 14.94],
      [120.81, 14.94],
      [120.81, 14.96],
      [120.79, 14.94],
    ],
  ],
}

function row(overrides: Partial<ValidatedFeedRow> = {}): ValidatedFeedRow {
  return {
    id: 1,
    latitude: 14.95,
    longitude: 120.8,
    gps_accuracy: 8,
    barangay: { id: 1, name: 'San Juan' },
    alert_level: 'alert',
    alert_level_label: 'Alert',
    alert_severity: 1,
    depth_cm: 100,
    observed_at: '2026-11-01T10:00:00Z',
    received_at: '2026-11-01T10:01:00Z',
    status: 'validated',
    status_label: 'Validated',
    source: 'reported',
    source_label: 'Reported',
    ...overrides,
  }
}

function band(bandName: string, minM: number, maxM: number, code = 'BRGY-01'): BandFeature {
  return {
    type: 'Feature',
    geometry: SQUARE,
    properties: { band: bandName, min_m: minM, max_m: maxM, brgy_code: code },
  }
}

const BANDS: BandFeature[] = [
  band('3-5', 3, 5),
  band('0-1', 0, 1),
  band('2-3', 2, 3),
  band('1-2', 1, 2),
]

const CODES = new Map<number, string>([
  [1, 'BRGY-01'],
  [2, 'BRGY-02'],
])

function samplerAt(elevationM: number | null, derived = false) {
  return { sample: () => ({ elevationM, derived }) }
}

describe('terrain elevation (FR-54)', () => {
  it('starts hidden and leaves the other layers on', () => {
    expect(DEFAULT_LAYERS).toEqual({ reported: true, inundation: true, terrain: false })
  })

  it('labels every ramp step with its elevation range in metres', () => {
    const ranges = terrainRanges()

    expect(ranges).toHaveLength(5)
    expect(ranges[0].label).toBe('below 0 m')
    expect(ranges[1].label).toBe('0–2 m')
    expect(ranges[3].label).toBe('5–10 m')
    expect(ranges[4].label).toBe('10 m and above')
    expect(new Set(ranges.map((range) => range.color)).size).toBe(5)
  })

  it('builds a step paint keyed on the band floor', () => {
    const paint = terrainFillPaint()
    const expression = paint['fill-color'] as unknown[]

    expect(expression[0]).toBe('step')
    expect(expression[1]).toEqual(['get', 'min_m'])
    // one base colour plus one per break
    expect(expression.length).toBe(2 + 1 + MAP_TERRAIN.breaks.length * 2)
    expect(paint['fill-opacity']).toBe(MAP_TERRAIN.fillOpacity)
    expect(terrainLinePaint()['line-color']).toBe(MAP_TERRAIN.line)
  })

  it('counts bands, barangays and the elevation extent', () => {
    const stats = terrainBandStats([...BANDS, band('6-8', 6, 8, 'BRGY-02')])

    expect(stats).toEqual({ bandCount: 5, barangayCount: 2, minM: 0, maxM: 8 })
    expect(terrainBandStats([])).toBeNull()
  })

  it('describes the layer with method, cell size, source and the accuracy gap', () => {
    const text = describeTerrain(BANDS, '≈29.9 m × 30.9 m cell at 14.95°')

    expect(text?.headline).toBe('Derived · terrain elevation')
    expect(text?.detail).toContain('4 bands in 1 barangay')
    expect(text?.detail).toContain('≈29.9 m × 30.9 m cell at 14.95°')
    expect(text?.detail).toContain('Copernicus DEM GLO-30')
    expect(text?.detail).toContain('vertical accuracy not recorded')
    expect(text?.detail).toContain('Derived — not an observation')
    expect(text?.detail).not.toMatch(/\bobserved layer\b/i)
  })

  it('states no cell size rather than inventing one when the artifact is unreadable', () => {
    expect(describeTerrain(BANDS, null)?.detail).toContain('Cell size unavailable.')
    expect(describeTerrain([], '≈30 m')).toBeNull()
  })

  it('never carries an alert colour and never the inundation fill', () => {
    const alertColors = new Set(Object.values(ALERT_TIER_STYLES).map((style) => style.fill))

    expect(MAP_TERRAIN.colors.filter((color) => alertColors.has(color))).toEqual([])
    expect(MAP_TERRAIN.colors).not.toContain(DERIVED_STYLE.fill)
  })
})

describe('ALERT_TIER_STYLES', () => {
  it('orders the tiers and sizes them by severity', () => {
    expect(ALERT_TIER_STYLES.alert.tier).toBe(1)
    expect(ALERT_TIER_STYLES.get_ready.tier).toBe(2)
    expect(ALERT_TIER_STYLES.red_alert.tier).toBe(3)
    expect(ALERT_TIER_STYLES.red_alert.radius).toBeGreaterThan(
      ALERT_TIER_STYLES.get_ready.radius,
    )
    expect(ALERT_TIER_STYLES.get_ready.radius).toBeGreaterThan(
      ALERT_TIER_STYLES.alert.radius,
    )
  })

  it('shares no color with the derived palette', () => {
    const alertColors = new Set(
      Object.values(ALERT_TIER_STYLES).flatMap((style) => [style.fill, style.stroke]),
    )

    expect(alertColors.has(DERIVED_STYLE.fill)).toBe(false)
    expect(alertColors.has(DERIVED_STYLE.stroke)).toBe(false)
  })
})

describe('feedPoints', () => {
  it('keeps finite coordinates and derives lon/lat', () => {
    const points = feedPoints([row({ id: 4, latitude: 14.91, longitude: 120.71 })])

    expect(points).toEqual([
      {
        row: expect.objectContaining({ id: 4 }),
        lon: 120.71,
        lat: 14.91,
      },
    ])
  })

  it('drops rows whose coordinates are not finite', () => {
    expect(
      feedPoints([
        row({ id: 1, latitude: Number.NaN }),
        row({ id: 2, longitude: Number.POSITIVE_INFINITY }),
        row({ id: 3 }),
      ]).map((point) => point.row.id),
    ).toEqual([3])
  })
})

describe('cellSizeForZoom', () => {
  it('halves the cell per zoom level from 12', () => {
    expect(cellSizeForZoom(12)).toBeCloseTo(0.02, 10)
    expect(cellSizeForZoom(13)).toBeCloseTo(0.01, 10)
    expect(cellSizeForZoom(16)).toBeCloseTo(0.00125, 10)
  })

  it('holds the zoom-12 cell when zoomed out and floors at zoom 20', () => {
    expect(cellSizeForZoom(9)).toBeCloseTo(0.02, 10)
    expect(cellSizeForZoom(20)).toBe(1e-4)
    expect(cellSizeForZoom(25)).toBe(1e-4)
  })
})

describe('highestTier', () => {
  it('returns null with no rows and the most severe tier otherwise', () => {
    expect(highestTier([])).toBeNull()
    expect(
      highestTier([
        row({ id: 1, alert_level: 'alert' }),
        row({ id: 2, alert_level: 'red_alert' }),
        row({ id: 3, alert_level: 'get_ready' }),
      ]),
    ).toBe('red_alert')
  })
})

describe('clusterMarkers', () => {
  it('plots a lone report as a point marker', () => {
    const markers = clusterMarkers(feedPoints([row({ id: 7 })]), 0.02)

    expect(markers).toEqual([
      { kind: 'point', id: 'p-7', lon: 120.8, lat: 14.95, row: expect.objectContaining({ id: 7 }) },
    ])
  })

  it('groups reports in one cell into a cluster with the highest tier', () => {
    const markers = clusterMarkers(
      feedPoints([
        row({ id: 1, latitude: 14.951, longitude: 120.801, alert_level: 'alert' }),
        row({ id: 2, latitude: 14.955, longitude: 120.805, alert_level: 'red_alert' }),
      ]),
      0.02,
    )

    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({
      kind: 'cluster',
      count: 2,
      tier: 'red_alert',
      lon: 120.803,
    })
    expect(markers[0].lat).toBeCloseTo(14.953, 10)
  })

  it('is independent of input order', () => {
    const rows = [
      row({ id: 3, latitude: 14.951, longitude: 120.801 }),
      row({ id: 1, latitude: 14.952, longitude: 120.802 }),
      row({ id: 2, latitude: 14.953, longitude: 120.803 }),
    ]

    const forward = clusterMarkers(feedPoints(rows), 0.02)
    const reverse = clusterMarkers(feedPoints([...rows].reverse()), 0.02)

    expect(reverse).toEqual(forward)
  })

  it('keeps reports in different cells apart, sorted north to south', () => {
    const markers = clusterMarkers(
      feedPoints([
        row({ id: 1, latitude: 14.91, longitude: 120.8 }),
        row({ id: 2, latitude: 14.99, longitude: 120.8 }),
      ]),
      0.02,
    )

    expect(markers.map((marker) => marker.kind)).toEqual(['point', 'point'])
    expect(markers.map((marker) => marker.lat)).toEqual([14.99, 14.91])
  })
})

describe('selectInundationSurface', () => {
  it('selects the bands at or below DEM + depth', () => {
    const surface = selectInundationSurface(
      [row({ depth_cm: 100 })],
      BANDS,
      samplerAt(2.0),
      CODES,
    )

    expect(surface.absent).toBe(false)
    expect(surface.bandLabels).toEqual(['0-1', '1-2', '2-3'])
    expect(surface.features.map((feature) => feature.properties.band)).toEqual([
      '0-1',
      '1-2',
      '2-3',
    ])
    expect(surface.drivers).toEqual([
      expect.objectContaining({
        reportId: 1,
        barangayCode: 'BRGY-01',
        baseElevationM: 2,
        depthCm: 100,
        waterSurfaceM: 3,
        derivedCell: false,
      }),
    ])
  })

  it('composes the threshold in metres from centimetres of depth', () => {
    const surface = selectInundationSurface(
      [row({ depth_cm: 50 })],
      BANDS,
      samplerAt(0.6),
      CODES,
    )

    expect(surface.drivers[0].waterSurfaceM).toBeCloseTo(1.1, 10)
    expect(surface.bandLabels).toEqual(['0-1'])
  })

  it('lets the latest validated report in a barangay drive the threshold', () => {
    const surface = selectInundationSurface(
      [
        row({ id: 1, depth_cm: 400, observed_at: '2026-11-01T09:00:00Z' }),
        row({ id: 2, depth_cm: 100, observed_at: '2026-11-01T11:00:00Z' }),
      ],
      BANDS,
      samplerAt(0.6),
      CODES,
    )

    expect(surface.drivers).toHaveLength(1)
    expect(surface.drivers[0].reportId).toBe(2)
    expect(surface.bandLabels).toEqual(['0-1'])
  })

  it('breaks an observed-time tie with the higher report id', () => {
    const surface = selectInundationSurface(
      [
        row({ id: 5, depth_cm: 400 }),
        row({ id: 9, depth_cm: 100 }),
      ],
      BANDS,
      samplerAt(0.6),
      CODES,
    )

    expect(surface.drivers[0].reportId).toBe(9)
  })

  it('draws nothing when the driving report has no recorded depth', () => {
    const surface = selectInundationSurface(
      [row({ depth_cm: null })],
      BANDS,
      samplerAt(1.0),
      CODES,
    )

    expect(surface.absent).toBe(true)
    expect(surface.features).toEqual([])
    expect(surface.excluded).toEqual([{ reportId: 1, reason: 'depth_not_recorded' }])
  })

  it('never infers depth from the alert tier', () => {
    const surface = selectInundationSurface(
      [row({ depth_cm: 0, alert_level: 'red_alert' })],
      BANDS,
      samplerAt(1.0),
      CODES,
    )

    expect(surface.excluded).toEqual([{ reportId: 1, reason: 'depth_not_recorded' }])
    expect(surface.features).toEqual([])
  })

  it('excludes a report outside the DEM', () => {
    const surface = selectInundationSurface(
      [row()],
      BANDS,
      samplerAt(null),
      CODES,
    )

    expect(surface.excluded).toEqual([{ reportId: 1, reason: 'elevation_unknown' }])
    expect(surface.absent).toBe(true)
  })

  it('excludes a barangay with no boundary in the release', () => {
    const surface = selectInundationSurface(
      [row({ barangay: { id: 99, name: 'Unknown' } })],
      BANDS,
      samplerAt(1.0),
      CODES,
    )

    expect(surface.excluded).toEqual([{ reportId: 1, reason: 'barangay_uncovered' }])
  })

  it('excludes a threshold below every band', () => {
    const surface = selectInundationSurface(
      [row({ depth_cm: 10 })],
      [band('1-2', 1, 2)],
      samplerAt(0),
      CODES,
    )

    expect(surface.excluded).toEqual([{ reportId: 1, reason: 'no_band_below_threshold' }])
  })

  it('deduplicates bands at the feature level but keeps one per barangay', () => {
    const surface = selectInundationSurface(
      [
        row({ id: 1, barangay: { id: 1, name: 'San Juan' } }),
        row({ id: 2, barangay: { id: 2, name: 'San Vicente' } }),
      ],
      [band('0-1', 0, 1, 'BRGY-01'), band('0-1', 0, 1, 'BRGY-02')],
      samplerAt(0.5),
      CODES,
    )

    expect(surface.features).toHaveLength(2)
    expect(surface.features.map((feature) => feature.properties.brgy_code)).toEqual([
      'BRGY-01',
      'BRGY-02',
    ])
    expect(surface.bandLabels).toEqual(['0-1'])
    expect(surface.drivers).toHaveLength(2)
  })

  it('records interpolated DEM cells on the driver', () => {
    const surface = selectInundationSurface(
      [row()],
      BANDS,
      samplerAt(1.0, true),
      CODES,
    )

    expect(surface.drivers[0].derivedCell).toBe(true)
  })
})

describe('describeSurface', () => {
  it('states the derived threshold rather than an observation', () => {
    const text = describeSurface(
      selectInundationSurface([row({ depth_cm: 100 })], BANDS, samplerAt(2.0), CODES),
    )

    expect(text.state).toBe('present')
    expect(text.headline).toBe('Derived · inundation below 3.00 m')
    expect(text.detail).toContain('1 barangay, 3 bands (0-1, 1-2, 2-3)')
    expect(text.detail).toContain('DEM(report point) + reported depth')
  })

  it('notes interpolated cells in the detail', () => {
    const text = describeSurface(
      selectInundationSurface([row()], BANDS, samplerAt(1.0, true), CODES),
    )

    expect(text.detail).toContain('1 of 1 sampled cells are interpolated')
  })

  it('explains a missing depth instead of falling back to the tier', () => {
    const text = describeSurface(
      selectInundationSurface([row({ depth_cm: null })], BANDS, samplerAt(1.0), CODES),
    )

    expect(text.state).toBe('absent')
    expect(text.headline).toBe('Derived surface: depth not recorded')
    expect(text.detail).toContain('never inferred from the alert tier')
  })

  it('lists the exclusion reason when no depth is the cause', () => {
    const text = describeSurface(
      selectInundationSurface([row()], BANDS, samplerAt(null), CODES),
    )

    expect(text.headline).toBe('Derived surface: not available')
    expect(text.detail).toContain('report #1 (elevation not in the DEM)')
  })

  it('says so when there is nothing to compose from', () => {
    const empty: SurfaceResult = {
      features: [],
      drivers: [],
      excluded: [],
      bandLabels: [],
      absent: true,
    }

    expect(describeSurface(empty).detail).toBe(
      'No validated report is in view, so there is no depth to compose a surface from.',
    )
  })
})

describe('surfaceFeatureCollection', () => {
  it('publishes the selected bands as a GeoJSON collection', () => {
    const surface = selectInundationSurface([row()], BANDS, samplerAt(1.0), CODES)
    const collection = surfaceFeatureCollection(surface)

    expect(collection.type).toBe('FeatureCollection')
    expect(collection.features).toEqual(surface.features)
  })
})
