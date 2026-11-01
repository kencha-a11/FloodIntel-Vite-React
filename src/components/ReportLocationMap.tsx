import { useEffect, useState } from 'react'
import { describeAccuracy, describeGroundElevation } from '../lib/detailMap'
import type { GroundElevationReadout } from '../lib/detailMap'
import {
  cellSizeMeters,
  describeCellSize,
  loadElevationSampler,
} from '../lib/elevation'
import { GeoArtifactError, loadGeoManifest } from '../lib/geoManifest'
import type { GeoManifest } from '../lib/geoManifest'
import { DATA_SOURCE_LABELS } from '../lib/vocabulary'
import type { FloodReport } from '../types/report'
import { LocationPinMap } from './LocationPinMap'

type ElevationState = {
  key: string
  readout: GroundElevationReadout | null
  error: string | null
}

/*
 * The detail-view location section (FR-51, FR-22): the shared pin map, the
 * translated address, and the ground elevation sampled from the same DEM the
 * command-center map uses. The map is `LocationPinMap`, which the capture form
 * loads too (D-115); this section adds the facts and the Derived elevation.
 * Every fact it draws also appears as text beside the map, which is the state
 * the view falls back to when the basemap fails.
 */
export default function ReportLocationMap({ report }: { report: FloodReport }) {
  const [manifest, setManifest] = useState<GeoManifest | null>(null)
  const [manifestError, setManifestError] = useState<string | null>(null)
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
          setManifestError(
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
  const unavailable = elevationError !== null || manifestError !== null
  const elevationValue =
    elevation?.readout?.value ?? (unavailable ? 'Unavailable' : 'Sampling…')
  const elevationNote =
    elevation?.readout?.note ??
    elevationError ??
    (manifestError !== null
      ? `The DEM could not be loaded: ${manifestError}`
      : 'Sampling the nearest DEM cell…')

  return (
    <section className="report-location" aria-labelledby="report-location-title">
      <div className="report-location-header">
        <h3 id="report-location-title">Location</h3>
      </div>

      <LocationPinMap
        latitude={report.latitude}
        longitude={report.longitude}
        accuracy={report.gps_accuracy}
        label="Report location map"
      />

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
