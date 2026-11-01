import { useEffect, useRef, useState } from 'react'
import { maplibregl } from '../lib/mapRuntime'
import { accuracyRing, ringBounds } from '../lib/detailMap'
import type { LonLat } from '../lib/detailMap'
import {
  GeoArtifactError,
  fetchGeoJson,
  loadGeoManifest,
} from '../lib/geoManifest'
import type { GeoManifest } from '../lib/geoManifest'
import {
  BASEMAP_ARTIFACTS,
  basemapAttribution,
  basemapVersionLabel,
  buildBasemapStyle,
} from '../lib/mapStyle'
import type { BasemapLayers, GeoJsonData } from '../lib/mapStyle'
import { MAP_REPORTED_ACCURACY } from '../styles/tokens'
import { Alert } from './ui'

const PIN_ZOOM = 16
const ACCURACY_SOURCE = 'report-accuracy'

type MapStatus = 'loading' | 'ready' | 'error'

/*
 * The one pin map, lazily loaded by both the report detail and the capture
 * form: the recorded point from the device fix, its GPS accuracy as a
 * ground-true radius, and the basemap version actually drawn. It never moves
 * the point — FR-05 pairs the pin with auto-captured GPS and NFR-05 freezes
 * that fix after capture (D-115). Every fact it draws also appears as text
 * beside it, which is the state both callers fall back to when the basemap
 * cannot load.
 */
export function LocationPinMap({
  latitude,
  longitude,
  accuracy,
  label,
}: {
  latitude: number
  longitude: number
  accuracy: number | null
  label: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [manifest, setManifest] = useState<GeoManifest | null>(null)
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading')
  const [mapError, setMapError] = useState<string | null>(null)

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
    const center: LonLat = [longitude, latitude]
    const ring = accuracyRing(center, accuracy)

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
          zoom: PIN_ZOOM,
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
  }, [manifest, latitude, longitude, accuracy])

  const versionLabel =
    manifest !== null
      ? basemapVersionLabel(manifest)
      : mapStatus === 'error'
        ? 'Basemap unavailable'
        : 'Loading basemap…'

  return (
    <>
      <div
        className="report-location-map"
        ref={containerRef}
        role="region"
        aria-label={label}
      />

      {mapStatus === 'error' && (
        <Alert tone="warning">
          The map could not be drawn
          {mapError === null ? '' : `: ${mapError}`}. The position and address
          below are the same record.
        </Alert>
      )}

      <p className="muted">{versionLabel}</p>
    </>
  )
}

export default LocationPinMap
