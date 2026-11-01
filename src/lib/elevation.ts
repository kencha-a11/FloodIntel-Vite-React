import { fetchGeoArtifact, type GeoManifest } from './geoManifest'

const HEADER_BYTES = 40
const NODATA_CM = -32768

export type DemHeader = {
  width: number
  height: number
  originLon: number
  originLat: number
  lonRes: number
  latRes: number
}

export type ElevationSample = {
  elevationM: number | null
  derived: boolean
}

export type DemCellSize = {
  eastWestM: number
  northSouthM: number
  midLatitude: number
}

const METRES_PER_DEGREE = 111_320

/**
 * The grid's cell size in metres, derived from the header rather than written
 * as a constant, so the legend states the artifact it actually rendered
 * (NFR-15). The longitude scale uses the grid's mid-latitude.
 */
export function cellSizeMeters(header: DemHeader): DemCellSize {
  const midLatitude = header.originLat - (header.height * header.latRes) / 2
  const cosLatitude = Math.cos((midLatitude * Math.PI) / 180)

  return {
    eastWestM: header.lonRes * METRES_PER_DEGREE * cosLatitude,
    northSouthM: header.latRes * METRES_PER_DEGREE,
    midLatitude,
  }
}

export function describeCellSize(size: DemCellSize): string {
  return `≈${size.eastWestM.toFixed(1)} m × ${size.northSouthM.toFixed(1)} m cell at ${size.midLatitude.toFixed(2)}°`
}

export type ElevationSampler = {
  release?: string
  header: DemHeader
  sample: (lon: number, lat: number) => ElevationSample
}

export function parseDemHeader(bytes: Uint8Array): DemHeader {
  if (bytes.byteLength < HEADER_BYTES) {
    throw new Error(`DEM header needs ${HEADER_BYTES} bytes, got ${bytes.byteLength}`)
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, HEADER_BYTES)
  const header: DemHeader = {
    width: view.getInt32(0, true),
    height: view.getInt32(4, true),
    originLon: view.getFloat64(8, true),
    originLat: view.getFloat64(16, true),
    lonRes: view.getFloat64(24, true),
    latRes: view.getFloat64(32, true),
  }

  if (header.width <= 0 || header.height <= 0 || header.lonRes <= 0 || header.latRes <= 0) {
    throw new Error('DEM header has non-positive dimensions or resolution')
  }

  return header
}

export function createElevationSampler(
  dem: Uint8Array,
  derivedMask: Uint8Array,
): ElevationSampler {
  const header = parseDemHeader(dem)
  const cells = header.width * header.height

  if (dem.byteLength !== HEADER_BYTES + cells * 2) {
    throw new Error(`DEM payload is ${dem.byteLength} bytes, expected ${HEADER_BYTES + cells * 2}`)
  }

  if (derivedMask.byteLength !== HEADER_BYTES + cells) {
    throw new Error(
      `derived mask is ${derivedMask.byteLength} bytes, expected ${HEADER_BYTES + cells}`,
    )
  }

  const elevations = new DataView(dem.buffer, dem.byteOffset + HEADER_BYTES, cells * 2)
  const derived = derivedMask.subarray(HEADER_BYTES)

  const sample = (lon: number, lat: number): ElevationSample => {
    const col = Math.floor((lon - header.originLon) / header.lonRes)
    const row = Math.floor((header.originLat - lat) / header.latRes)

    if (!Number.isFinite(col) || !Number.isFinite(row)) {
      return { elevationM: null, derived: false }
    }

    if (col < 0 || row < 0 || col >= header.width || row >= header.height) {
      return { elevationM: null, derived: false }
    }

    const index = row * header.width + col
    const centimetres = elevations.getInt16(index * 2, true)

    if (centimetres === NODATA_CM) {
      return { elevationM: null, derived: derived[index] === 1 }
    }

    return { elevationM: centimetres / 100, derived: derived[index] === 1 }
  }

  return { header, sample }
}

export async function loadElevationSampler(
  manifest: GeoManifest,
  baseUrl = '/geo',
): Promise<ElevationSampler> {
  const [dem, derived] = await Promise.all([
    fetchGeoArtifact(manifest, 'apalit-dem', baseUrl),
    fetchGeoArtifact(manifest, 'apalit-dem-derived', baseUrl),
  ])
  const sampler = createElevationSampler(dem.bytes, derived.bytes)

  return { ...sampler, release: manifest.release }
}
