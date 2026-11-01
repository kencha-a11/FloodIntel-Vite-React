import { useCallback, useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre derives its worker from import.meta.url, which points at the
// bundled chunk. Point it at the emitted asset instead.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useAuth } from '../context/useAuth'
import { AuthApiError, getStoredToken } from '../lib/authApi'
import { loadElevationSampler, cellSizeMeters, describeCellSize } from '../lib/elevation'
import { feedPollEnabled } from '../lib/feedPoll'
import {
  GeoArtifactError,
  fetchGeoJson,
  loadGeoManifest,
} from '../lib/geoManifest'
import type { GeoManifest } from '../lib/geoManifest'
import {
  ALERT_TIER_STYLES,
  DEFAULT_LAYERS,
  DERIVED_STYLE,
  cellSizeForZoom,
  clusterMarkers,
  describeSurface,
  describeTerrain,
  feedPoints,
  selectInundationSurface,
  surfaceFeatureCollection,
  terrainFillPaint,
  terrainLinePaint,
} from '../lib/mapLayers'
import type {
  BandCollection,
  BandFeature,
  LayerVisibility,
  MapMarker,
  SurfaceResult,
} from '../lib/mapLayers'
import {
  BASEMAP_ARTIFACTS,
  basemapAttribution,
  basemapVersionLabel,
  buildBasemapStyle,
} from '../lib/mapStyle'
import type { BasemapLayers, GeoJsonData } from '../lib/mapStyle'
import * as reportApi from '../lib/reportApi'
import { affectsValidatedFeed } from '../lib/realtimeFeed'
import { useFeedPoll } from '../lib/useFeedPoll'
import { useRealtimeFeed } from '../lib/useRealtimeFeed'
import { FreshnessBar } from './FreshnessBar'
import { Button } from './ui'
import {
  ALERT_LEVEL_ORDER,
  ALERT_TIERS,
  DATA_SOURCE_LABELS,
  DATA_SOURCE_NOTES,
  alertTierLabel,
  alertTierShortLabel,
  dataSourceLabel,
  reportStatusLabel,
} from '../lib/vocabulary'
import type { Barangay, ValidatedFeedMeta, ValidatedFeedRow } from '../types/report'
import type { RealtimeUpdate } from '../types/realtime'

const APALIT_CENTER: [number, number] = [120.8001, 14.9545]
const INITIAL_ZOOM = 12.2
const FEED_LIMIT = 500
const SURFACE_SOURCE = 'inundation-derived'
const SURFACE_ATTRIBUTION =
  'Elevation: Copernicus DEM (COPDEM-30); inundation thresholds derived (D-78)'
const TERRAIN_SOURCE = 'terrain-bands'
const TERRAIN_ATTRIBUTION = 'Terrain bands: Copernicus DEM GLO-30 (COPDEM-30), derived'

// FR-56: every layer control carries a one-line description of what it contains.
const LAYER_DESCRIPTIONS: Record<keyof LayerVisibility, string> = {
  reported: `Validated reports as numbered markers, one per report. ${DATA_SOURCE_NOTES.reported}`,
  inundation: `Bands at or below the sampled DEM elevation plus the reported depth, clipped to each driving barangay. ${DATA_SOURCE_NOTES.derived}`,
  terrain: 'Every elevation band the DEM yields for each barangay, graded by the band floor elevation.',
}

type LayerStatus = 'idle' | 'loading' | 'ready' | 'forbidden' | 'error'

function readOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

function formatInstant(value: string): string {
  return new Date(value).toLocaleString()
}

function markerButton(
  tier: keyof typeof ALERT_TIER_STYLES,
  label: string,
  accessibleLabel: string,
  cluster: boolean,
): HTMLButtonElement {
  const style = ALERT_TIER_STYLES[tier]
  const button = document.createElement('button')

  button.type = 'button'
  button.className = cluster ? 'map-marker map-marker-cluster' : 'map-marker'
  button.dataset.tier = String(style.tier)
  button.setAttribute('aria-label', accessibleLabel)
  button.title = accessibleLabel

  const dot = document.createElement('span')
  dot.className = 'map-marker-dot'
  dot.style.setProperty('--marker-fill', style.fill)
  dot.style.setProperty('--marker-stroke', style.stroke)
  dot.style.setProperty('--marker-text', style.text)
  dot.style.setProperty('--marker-size', `${cluster ? 34 : style.radius * 2}px`)
  dot.textContent = label
  button.append(dot)

  return button
}

function popupContent(row: ValidatedFeedRow): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'map-popup'

  const heading = document.createElement('strong')
  heading.textContent = alertTierLabel(row.alert_level)
  wrapper.append(heading)

  const barangay = document.createElement('p')
  barangay.textContent = row.barangay.name
  wrapper.append(barangay)

  const observed = document.createElement('p')
  observed.className = 'muted'
  observed.textContent = `Observed ${formatInstant(row.observed_at)}`
  wrapper.append(observed)

  // FR-58: observed and received are separate instants and never merged.
  const received = document.createElement('p')
  received.className = 'muted'
  received.textContent = `Received ${formatInstant(row.received_at)}`
  wrapper.append(received)

  const depth = document.createElement('p')
  depth.className = 'muted'
  depth.textContent =
    row.depth_cm === null ? 'Depth not recorded' : `Depth ${row.depth_cm} cm`
  wrapper.append(depth)

  const source = document.createElement('p')
  source.className = 'muted'
  source.textContent = `${dataSourceLabel(row.source)} · ${reportStatusLabel(row.status)}`
  wrapper.append(source)

  return wrapper
}

function codeById(barangays: Barangay[]): Map<number, string> {
  return new Map(
    barangays
      .filter((barangay) => barangay.code !== '')
      .map((barangay) => [barangay.id, barangay.code]),
  )
}

// The control names the layer the legend names, through the shared vocabulary.
function layerLabel(layer: keyof LayerVisibility): string {
  if (layer === 'reported') {
    return `${DATA_SOURCE_LABELS.reported} markers`
  }

  return `${DATA_SOURCE_LABELS.derived} · ${layer === 'inundation' ? 'inundation' : 'terrain elevation'}`
}

export default function MapView({ canViewValidatedFeed }: { canViewValidatedFeed: boolean }) {
  const { logout } = useAuth()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const domMarkersRef = useRef<maplibregl.Marker[]>([])
  const popupRef = useRef<maplibregl.Popup | null>(null)

  const [manifest, setManifest] = useState<GeoManifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(readOnline)
  const [mapReady, setMapReady] = useState(false)
  const [zoomTick, setZoomTick] = useState(0)
  const [layerStatus, setLayerStatus] = useState<LayerStatus>('idle')
  const [layerError, setLayerError] = useState<string | null>(null)
  const [rows, setRows] = useState<ValidatedFeedRow[]>([])
  const [feedMeta, setFeedMeta] = useState<ValidatedFeedMeta | null>(null)
  const [barangays, setBarangays] = useState<Map<number, string>>(new Map())
  const [surface, setSurface] = useState<SurfaceResult | null>(null)
  const [surfaceError, setSurfaceError] = useState<string | null>(null)
  const [markers, setMarkers] = useState<MapMarker[]>([])
  const [bands, setBands] = useState<BandFeature[]>([])
  const [cellSize, setCellSize] = useState<string | null>(null)
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS)
  const appliedRef = useRef(false)
  const bandsRef = useRef(false)
  const refreshRef = useRef<() => void>(() => {})

  const toggleLayer = useCallback((layer: keyof LayerVisibility) => {
    setLayers((value) => ({ ...value, [layer]: !value[layer] }))
  }, [])

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let map: maplibregl.Map | null = null

    void (async () => {
      try {
        const loaded = await loadGeoManifest()
        const layers: BasemapLayers = {}

        for (const name of BASEMAP_ARTIFACTS) {
          const { data } = await fetchGeoJson<GeoJsonData>(loaded, name)
          layers[name] = data
        }

        if (cancelled || containerRef.current === null) {
          return
        }

        maplibregl.setWorkerUrl(maplibreWorkerUrl)

        map = new maplibregl.Map({
          container: containerRef.current,
          style: buildBasemapStyle(layers, basemapAttribution(loaded)),
          center: APALIT_CENTER,
          zoom: INITIAL_ZOOM,
          attributionControl: false,
        })

        map.addControl(new maplibregl.AttributionControl({ compact: false }))
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          'top-right',
        )

        map.on('zoomend', () => setZoomTick((value) => value + 1))

        mapRef.current = map
        setManifest(loaded)
        setMapReady(true)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof GeoArtifactError
              ? err.message
              : 'The basemap could not be loaded.',
          )
        }
      }
    })()

    return () => {
      cancelled = true
      for (const marker of domMarkersRef.current) {
        marker.remove()
      }
      domMarkersRef.current = []
      popupRef.current?.remove()
      popupRef.current = null
      map?.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!canViewValidatedFeed) {
        setLayerStatus('forbidden')
        return
      }

      if (!appliedRef.current) {
        setLayerStatus('loading')
        setLayerError(null)
      }

      const token = getStoredToken()

      if (token === null) {
        setLayerStatus('forbidden')
        return
      }

      try {
        const feed = await reportApi.listValidatedFeed(token, {
          limit: FEED_LIMIT,
        })

        if (signal.aborted) {
          return
        }

        appliedRef.current = true
        setRows(feed.data)
        setFeedMeta(feed.meta)
        setLayerStatus('ready')
        setLayerError(null)
      } catch (err) {
        if (signal.aborted) {
          return
        }

        const message =
          err instanceof AuthApiError
            ? err.message
            : 'Validated reports could not be loaded.'

        if (err instanceof AuthApiError && err.status === 401) {
          await logout()
        } else if (err instanceof AuthApiError && err.status === 403) {
          setLayerStatus('forbidden')
        } else if (appliedRef.current) {
          // A failed refresh keeps the last plotted set on the map and lets the
          // reading age into stale rather than blanking the screen.
          setLayerError(message)
        } else {
          setLayerStatus('error')
          setLayerError(message)
        }

        throw err
      }
    },
    [canViewValidatedFeed, logout],
  )

  const handleRealtimeUpdate = useCallback((update: RealtimeUpdate) => {
    if (affectsValidatedFeed(update)) {
      refreshRef.current()
    }
  }, [])

  const { status: realtimeStatus } = useRealtimeFeed(handleRealtimeUpdate)
  const { lastSuccessAt, refresh } = useFeedPoll(load, {
    enabled: feedPollEnabled(realtimeStatus),
  })

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    if (!canViewValidatedFeed) {
      return
    }

    let cancelled = false
    const token = getStoredToken()

    if (token === null) {
      return
    }

    void reportApi
      .listBarangays(token)
      .then((response) => {
        if (!cancelled) {
          setBarangays(codeById(response))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBarangays(new Map())
        }
      })

    return () => {
      cancelled = true
    }
  }, [canViewValidatedFeed])

  useEffect(() => {
    if (
      manifest === null ||
      !canViewValidatedFeed ||
      layerStatus !== 'ready'
    ) {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const [bandArtifact, sampler] = await Promise.all([
          fetchGeoJson<BandCollection>(manifest, 'apalit-elevation'),
          loadElevationSampler(manifest),
        ])

        if (cancelled) {
          return
        }

        // The terrain layer and the cell-size disclosure read the same verified
        // artifact the surface was composed from, loaded once.
        if (!bandsRef.current) {
          bandsRef.current = true
          setBands(bandArtifact.data.features)
          setCellSize(describeCellSize(cellSizeMeters(sampler.header)))
        }

        setSurface(
          selectInundationSurface(rows, bandArtifact.data.features, sampler, barangays),
        )
        setSurfaceError(null)
      } catch (err) {
        if (!cancelled) {
          setSurface(null)
          setSurfaceError(
            err instanceof GeoArtifactError
              ? err.message
              : 'The derived surface artifacts could not be loaded.',
          )
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [rows, barangays, manifest, canViewValidatedFeed, layerStatus])

  useEffect(() => {
    const map = mapRef.current

    if (map === null) {
      return
    }

    for (const marker of domMarkersRef.current) {
      marker.remove()
    }

    domMarkersRef.current = []
    popupRef.current?.remove()
    popupRef.current = null

    if (!layers.reported || rows.length === 0) {
      setMarkers([])
      return
    }

    const clustered = clusterMarkers(
      feedPoints(rows),
      cellSizeForZoom(map.getZoom()),
    )

    setMarkers(clustered)

    const nextMarkers = clustered.map((marker) => {
      const tier = marker.kind === 'cluster' ? marker.tier : marker.row.alert_level
      const style = ALERT_TIER_STYLES[tier]
      const label = String(marker.kind === 'cluster' ? marker.count : style.tier)
      const accessibleLabel =
        marker.kind === 'cluster'
          ? `${marker.count} validated reports, highest ${alertTierLabel(tier)}. Activate to zoom in.`
          : `${alertTierLabel(tier)}, ${marker.row.barangay.name}, observed ${formatInstant(marker.row.observed_at)}`

      const element = markerButton(
        tier,
        label,
        accessibleLabel,
        marker.kind === 'cluster',
      )

      element.addEventListener('click', (event) => {
        event.stopPropagation()

        if (marker.kind === 'cluster') {
          map.easeTo({
            center: [marker.lon, marker.lat],
            zoom: Math.min(map.getZoom() + 2, 17),
          })
          return
        }

        popupRef.current?.remove()
        popupRef.current = new maplibregl.Popup({ offset: 20, closeButton: true })
          .setLngLat([marker.lon, marker.lat])
          .setDOMContent(popupContent(marker.row))
          .addTo(map)
      })

      return new maplibregl.Marker({ element, anchor: 'center' })
        .setLngLat([marker.lon, marker.lat])
        .addTo(map)
    })

    domMarkersRef.current = nextMarkers

    return () => {
      for (const marker of nextMarkers) {
        marker.remove()
      }
      domMarkersRef.current = []
    }
    // zoomTick re-clusters at the new zoom.
  }, [rows, mapReady, zoomTick, layers.reported])

  useEffect(() => {
    const map = mapRef.current

    if (map === null) {
      return
    }

    const clear = () => {
      if (mapRef.current !== map) {
        return
      }

      if (map.getLayer('inundation-fill') !== undefined) {
        map.removeLayer('inundation-fill')
      }

      if (map.getLayer('inundation-outline') !== undefined) {
        map.removeLayer('inundation-outline')
      }

      if (map.getSource(SURFACE_SOURCE) !== undefined) {
        map.removeSource(SURFACE_SOURCE)
      }
    }

    const apply = () => {
      clear()

      if (!layers.inundation || surface === null || surface.features.length === 0) {
        return
      }

      map.addSource(SURFACE_SOURCE, {
        type: 'geojson',
        data: surfaceFeatureCollection(surface),
        attribution: SURFACE_ATTRIBUTION,
      })

      map.addLayer({
        id: 'inundation-fill',
        type: 'fill',
        source: SURFACE_SOURCE,
        paint: {
          'fill-color': DERIVED_STYLE.fill,
          'fill-opacity': DERIVED_STYLE.fillOpacity,
          'fill-outline-color': DERIVED_STYLE.stroke,
        },
      })

      map.addLayer({
        id: 'inundation-outline',
        type: 'line',
        source: SURFACE_SOURCE,
        paint: {
          'line-color': DERIVED_STYLE.stroke,
          'line-width': 1,
          'line-dasharray': [...DERIVED_STYLE.dash],
        },
      })
    }

    if (map.isStyleLoaded()) {
      apply()

      return clear
    }

    map.once('load', apply)

    return () => {
      map.off('load', apply)
      clear()
    }
  }, [surface, mapReady, layers.inundation])

  // FR-54: terrain is its own layer, toggled independently of inundation and
  // off by default, drawn as a graded ramp rather than the flat derived fill.
  useEffect(() => {
    const map = mapRef.current

    if (map === null) {
      return
    }

    const clear = () => {
      if (mapRef.current !== map) {
        return
      }

      for (const id of ['terrain-fill', 'terrain-bands']) {
        if (map.getLayer(id) !== undefined) {
          map.removeLayer(id)
        }
      }

      if (map.getSource(TERRAIN_SOURCE) !== undefined) {
        map.removeSource(TERRAIN_SOURCE)
      }
    }

    const apply = () => {
      clear()

      if (!layers.terrain || bands.length === 0) {
        return
      }

      map.addSource(TERRAIN_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: bands },
        attribution: TERRAIN_ATTRIBUTION,
      })

      // Under the flood surface when it is shown: terrain is context, not the
      // thing the operator reads off the map.
      const beforeId =
        map.getLayer('inundation-fill') !== undefined ? 'inundation-fill' : undefined

      map.addLayer(
        {
          id: 'terrain-fill',
          type: 'fill',
          source: TERRAIN_SOURCE,
          paint: terrainFillPaint(),
        },
        beforeId,
      )

      map.addLayer(
        {
          id: 'terrain-bands',
          type: 'line',
          source: TERRAIN_SOURCE,
          paint: terrainLinePaint(),
        },
        beforeId,
      )
    }

    if (map.isStyleLoaded()) {
      apply()

      return clear
    }

    map.once('load', apply)

    return () => {
      map.off('load', apply)
      clear()
    }
  }, [bands, mapReady, layers.terrain])

  const surfaceText = surface === null ? null : describeSurface(surface)
  const terrainText = bands.length === 0 ? null : describeTerrain(bands, cellSize)
  const clusterCount = markers.filter((marker) => marker.kind === 'cluster').length

  if (!canViewValidatedFeed) {
    return (
      <div className="map-view">
        <div className="map-view-header">
          <div>
            <h2>Apalit flood map</h2>
            <p className="muted">
              The flood map shows validated reports and is limited to roles that can
              view validated reports.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="map-view">
      <div className="map-view-header">
        <div>
          <h2>Apalit flood map</h2>
          <p className="muted">
            {manifest === null
              ? 'Loading basemap…'
              : basemapVersionLabel(manifest)}
          </p>
          <p className="muted" data-testid="map-feed-summary">
            {layerStatus === 'loading' && 'Loading validated reports…'}
            {layerStatus === 'ready' &&
              `${rows.length} validated report${rows.length === 1 ? '' : 's'}${
                clusterCount > 0 ? ` in ${markers.length} markers` : ''
              }`}
            {layerStatus === 'forbidden' &&
              'Your role cannot view validated reports.'}
            {layerStatus === 'error' &&
              (layerError ?? 'Validated reports could not be loaded.')}
          </p>
          {feedMeta?.truncated === true && (
            <p className="form-error" role="status">
              Showing the first {feedMeta.limit} validated reports; the extent is
              truncated.
            </p>
          )}
        </div>
      </div>

      <FreshnessBar
        lastSuccessAt={lastSuccessAt}
        live={realtimeStatus === 'live'}
        onRefresh={refresh}
      />

      {layerStatus === 'ready' && layerError !== null && (
        <p className="form-error" role="status" data-testid="map-refresh-failure">
          {layerError} The markers are the last set the map loaded.
        </p>
      )}

      {error !== null && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {!online && manifest !== null && error === null && (
        <p className="map-offline" role="status">
          Offline — showing the cached basemap ({basemapVersionLabel(manifest)}).
          {rows.length > 0 && ' Plotted reports are the last loaded set.'}
        </p>
      )}

      {error === null && <div ref={containerRef} className="map-canvas" />}

      <div className="map-layers" role="group" aria-label="Map layers" data-testid="map-layer-control">
        {(Object.keys(LAYER_DESCRIPTIONS) as Array<keyof LayerVisibility>).map((layer) => (
          <div className="map-layer" key={layer}>
            <Button
              variant={layers[layer] ? 'primary' : 'secondary'}
              size="compact"
              aria-pressed={layers[layer]}
              aria-describedby={`map-layer-${layer}-description`}
              onClick={() => toggleLayer(layer)}
            >
              {layerLabel(layer)} — {layers[layer] ? 'on' : 'off'}
            </Button>
            <p className="muted" id={`map-layer-${layer}-description`}>
              {LAYER_DESCRIPTIONS[layer]}
            </p>
          </div>
        ))}
      </div>

      <div className="map-legend" data-testid="map-legend">
        <p>
          <span className="map-legend-swatch map-legend-reported" aria-hidden="true" />
          <strong>{DATA_SOURCE_LABELS.reported}</strong> — validated observation,
          marker numbered by alert tier (
          {ALERT_LEVEL_ORDER.map((level) => `${ALERT_TIERS[level].tier} ${alertTierShortLabel(level)}`).join(', ')}).
          {' Unit: alert tier, 1–3.'}
        </p>
        {surfaceText !== null && (
          <>
            <p>
              <span className="map-legend-swatch map-legend-derived" aria-hidden="true" />
              <strong>{surfaceText.headline}</strong>
            </p>
            <p className="muted">{surfaceText.detail}</p>
          </>
        )}
        {surfaceError !== null && (
          <p className="muted" role="status">
            Derived surface unavailable: {surfaceError}
          </p>
        )}
        {terrainText !== null && (
          <>
            <p>
              <strong>{terrainText.headline}</strong>
              <span className="muted"> — {layers.terrain ? 'shown' : 'hidden (off by default)'}</span>
            </p>
            <p className="muted">{terrainText.detail}</p>
            <ul className="map-legend-ramp" data-testid="map-terrain-ramp">
              {terrainText.ranges.map((range) => (
                <li key={range.label}>
                  <span
                    className="map-legend-swatch map-legend-terrain"
                    style={{ ['--terrain-stop' as string]: range.color }}
                    aria-hidden="true"
                  />
                  {range.label}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="muted">
          {DATA_SOURCE_LABELS.predicted} is not shown — no model artifact exists yet (FR-55).
        </p>
      </div>

      <p className="map-attribution muted">
        Basemap artifacts are served from this app. Boundaries: PSA/NAMRIA
        (CC BY-IGO). Map data: © OpenStreetMap contributors (ODbL). Elevation:
        Copernicus DEM (COPDEM-30); terrain bands are derived.
      </p>
    </div>
  )
}
