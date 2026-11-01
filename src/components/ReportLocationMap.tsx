import { useEffect, useRef, useState } from 'react'
import { maplibregl } from '../lib/mapRuntime'
import {
  accuracyRing,
  describeAccuracy,
  describeGroundElevation,
  ringBounds,
} from '../lib/detailMap'
import type { GroundElevationReadout, LonLat } from '../lib/detailMap'
import {
  cellSizeMeters,
  describeCellSize,
  loadElevationSampler,
} from '../lib/elevation'
import { GeoArtifactError, fetchGeoJson, loadGeoManifest } from '../lib/geoManifest'
import type { GeoManifest } from '../lib/geoManifest'
import {
  BASEMAP_ARTIFACTS,
  basemapAttribution,
  basemapVersionLabel,
  buildBasemapStyle,
} from '../lib/mapStyle'
import type { BasemapLayers, GeoJsonData } from '../lib/mapStyle'
import { DATA_SOURCE_LABELS } from '../lib/vocabulary'
import type { FloodReport } from '../types/report'
import { MAP_REPORTED_ACCURACY } from '../styles/tokens'
import { Alert } from './ui'

const DETAIL_ZOOM = 16
const ACCURACY_SOURCE = 'report-accuracy'

type MapStatus = 'loading' | 'ready' | 'error'

type ElevationState = {
  key: string
  readout: GroundElevationReadout | null
  error: string | null
}

/*
 * The detail-view location map (FR-51, FR-22): the recorded pin, the GPS
 * accuracy as a ground-true radius, the translated address, and the ground
 * elevation sampled from the same DEM the command-center map uses. It is a
 * lazy chunk of its own so a review queue that never opens a report never
 * downloads MapLibre, and every fact it draws also appears as text beside it,
 * which is the state the view falls back to when the basemap fails.
 */
export default function ReportLocationMap({ report }: { report: FloodReport }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [manifest, setManifest] = useState<GeoManifest | null>(null)
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading')
  const [mapError, setMapError] = useState<string | null>(null)
  const [elevationState, setElevationState] = useState<ElevationState | null>(null)
  const locationKey = `${report.id}:${report.latitude}:${report.longitude}`

  useEffect(() => {
    let cancelled = false

    void loadGeoManifest()
      .then((loaded) => {
        if (!cancelled) {
          setManifest(loaded)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMapStatus('error')
          setMapError(
            error instanceof GeoArtifactError
              ? error.message
              : 'The basemap manifest could not be loaded.',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (manifest === null) {
      return
    }

    const container = containerRef.current

    if (container === null) {
      return
    }

    let cancelled = false
    let map: maplibregl.Map | null = null
    let marker: maplibregl.Marker | null = null
    let loaded = false
    const center: LonLat = [report.longitude, report.latitude]
    const ring = accuracyRing(center, report.gps_accuracy)

    setMapStatus('loading')
    setMapError(null)

    void (async () => {
      try {
        const layers: BasemapLayers = {}

        for (const name of BASEMAP_ARTIFACTS) {
          const { data } = await fetchGeoJson<GeoJsonData>(manifest, name)

          if (cancelled) {
            return
          }

          layers[name] = data
        }

        map = new maplibregl.Map({
          container,
          style: buildBasemapStyle(layers, basemapAttribution(manifest)),
          center,
          zoom: DETAIL_ZOOM,
          attributionControl: false,
          scrollZoom: false,
          dragRotate: false,
        })

        const pin = document.createElement('div')
        pin.className = 'report-location-pin'

        marker = new maplibregl.Marker({ element: pin }).setLngLat(center).addTo(map)
        map.addControl(new maplibregl.AttributionControl({ compact: false }))

        map.on('error', (event) => {
          if (!cancelled && !loaded) {
            setMapStatus('error')
            setMapError(
              event.error instanceof Error
                ? event.error.message
                : 'The basemap did not load.',
            )
          }
        })

        map.once('load', () => {
          if (cancelled || map === null) {
            return
          }

          loaded = true

          if (ring !== null) {
            map.addSource(ACCURACY_SOURCE, { type: 'geojson', data: ring })
            map.addLayer({
              id: 'report-accuracy-fill',
              type: 'fill',
              source: ACCURACY_SOURCE,
              paint: {
                'fill-color': MAP_REPORTED_ACCURACY.fill,
                'fill-opacity': MAP_REPORTED_ACCURACY.fillOpacity,
              },
            })
            map.addLayer({
              id: 'report-accuracy-outline',
              type: 'line',
              source: ACCURACY_SOURCE,
              paint: {
                'line-color': MAP_REPORTED_ACCURACY.stroke,
                'line-width': 1,
              },
            })
            map.fitBounds(ringBounds(ring), {
              padding: 48,
              maxZoom: 17,
              duration: 0,
            })
          }

          setMapStatus('ready')
          setMapError(null)
        })
      } catch (error) {
        if (!cancelled) {
          setMapStatus('error')
          setMapError(
            error instanceof GeoArtifactError
              ? error.message
              : 'The basemap could not be loaded.',
          )
        }
      }
    })()

    return () => {
      cancelled = true
      marker?.remove()
      map?.remove()
    }
  }, [manifest, report.latitude, report.longitude, report.gps_accuracy])

  useEffect(() => {
    if (manifest === null) {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const sampler = await loadElevationSampler(manifest)

        if (cancelled) {
          return
        }

        setElevationState({
          key: locationKey,
          readout: describeGroundElevation(
            sampler.sample(report.longitude, report.latitude),
            describeCellSize(cellSizeMeters(sampler.header)),
          ),
          error: null,
        })
      } catch (error) {
        if (!cancelled) {
          setElevationState({
            key: locationKey,
            readout: null,
            error:
              error instanceof GeoArtifactError
                ? error.message
                : 'The DEM could not be sampled.',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [manifest, locationKey, report.latitude, report.longitude])

  const elevation =
    elevationState !== null && elevationState.key === locationKey
      ? elevationState
      : null
  const elevationError = elevation?.error ?? null
  const unavailable =
    elevationError !== null || (manifest === null && mapError !== null)
  const elevationValue =
    elevation?.readout?.value ?? (unavailable ? 'Unavailable' : 'Sampling…')
  const elevationNote =
    elevation?.readout?.note ??
    elevationError ??
    (manifest === null && mapError !== null
      ? `The DEM could not be loaded: ${mapError}`
      : 'Sampling the nearest DEM cell…')
  const versionLabel =
    manifest !== null
      ? basemapVersionLabel(manifest)
      : mapStatus === 'error'
        ? 'Basemap unavailable'
        : 'Loading basemap…'

  return (
    <section className="report-location" aria-labelledby="report-location-title">
      <div className="report-location-header">
        <h3 id="report-location-title">Location</h3>
        <p className="muted">{versionLabel}</p>
      </div>

      <div
        className="report-location-map"
        ref={containerRef}
        role="region"
        aria-label="Report location map"
      />

      {mapStatus === 'error' && (
        <Alert tone="warning">
          The map could not be drawn
          {mapError === null ? '' : `: ${mapError}`}. The position and address
          below are the same record.
        </Alert>
      )}

      <dl className="report-location-facts" data-testid="report-location-facts">
        <div>
          <dt>Position</dt>
          <dd className="report-location-coordinate">
            {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
          </dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{describeAccuracy(report.gps_accuracy)}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{report.address ?? 'Not available'}</dd>
        </div>
        <div>
          <dt>Ground elevation · {DATA_SOURCE_LABELS.derived}</dt>
          <dd data-testid="report-location-elevation">{elevationValue}</dd>
        </div>
      </dl>

      <p className="muted">{elevationNote}</p>
      <p className="muted">
        The address is a translation of the recorded coordinates, not the
        source of the position (FR-32).
      </p>
    </section>
  )
}
