const MANIFEST_VERSION = 1
const DEFAULT_BASE_URL = '/geo'

export type GeoLicense = {
  id: string
  name: string
  url: string
}

export type GeoArtifact = {
  name: string
  path: string
  format: 'geojson' | 'binary'
  sha256: string
  bytes: number
  feature_count?: number
  source: string
  vintage: string
  license: GeoLicense
  attribution: string
  derived: boolean
  notes?: string
}

export type GeoBlocked = {
  name: string
  staged_path: string
  sha256: string
  reason: string
  detail: string
  license: { status: 'unrecorded' }
}

export type GeoManifest = {
  manifest_version: number
  dataset: string
  release: string
  generated_at: string
  crs: string
  axis_order: string
  coordinate_precision: number
  generator: { command: string; inputs: { path: string; sha256: string }[] }
  artifacts: GeoArtifact[]
  blocked: GeoBlocked[]
  interior_fill: { count: number; artifact: string }
  warnings: { code: string; message: string }[]
}

export type GeoErrorCode =
  | 'manifest-unavailable'
  | 'artifact-missing'
  | 'artifact-blocked'
  | 'artifact-unavailable'
  | 'checksum-mismatch'

export class GeoArtifactError extends Error {
  readonly code: GeoErrorCode

  constructor(code: GeoErrorCode, message: string) {
    super(message)
    this.name = 'GeoArtifactError'
    this.code = code
  }
}

export type GeoArtifactBytes = {
  artifact: GeoArtifact
  bytes: Uint8Array
}

const manifestCache = new Map<string, Promise<GeoManifest>>()
const artifactCache = new Map<string, Promise<GeoArtifactBytes>>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function failClosedManifest(detail: string): never {
  throw new GeoArtifactError('manifest-unavailable', `geo manifest is unusable: ${detail}`)
}

function assertManifest(value: unknown): asserts value is GeoManifest {
  if (!isRecord(value)) {
    failClosedManifest('not an object')
  }

  if (value.manifest_version !== MANIFEST_VERSION) {
    failClosedManifest(`unsupported manifest_version ${String(value.manifest_version)}`)
  }

  if (typeof value.release !== 'string' || value.release === '') {
    failClosedManifest('missing release')
  }

  if (!Array.isArray(value.artifacts) || !Array.isArray(value.blocked)) {
    failClosedManifest('artifacts and blocked must be arrays')
  }

  const names = new Set<string>()

  for (const entry of value.artifacts) {
    if (!isRecord(entry)) {
      failClosedManifest('artifact entry is not an object')
    }

    const { name, path, sha256 } = entry

    if (typeof name !== 'string' || typeof path !== 'string') {
      failClosedManifest('artifact entry is missing name or path')
    }

    if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) {
      failClosedManifest(`artifact ${name} has no valid sha256`)
    }

    if (names.has(name)) {
      failClosedManifest(`artifact ${name} appears twice`)
    }

    names.add(name)
  }
}

export function resolveArtifactUrl(artifact: GeoArtifact, baseUrl = DEFAULT_BASE_URL): string {
  const file = artifact.path.slice(artifact.path.lastIndexOf('/') + 1)

  return `${baseUrl.replace(/\/$/, '')}/${file}`
}

export function loadGeoManifest(baseUrl = DEFAULT_BASE_URL): Promise<GeoManifest> {
  const cached = manifestCache.get(baseUrl)

  if (cached !== undefined) {
    return cached
  }

  const pending = fetch(`${baseUrl}/manifest.json`, { cache: 'no-cache' })
    .then(async (response) => {
      if (!response.ok) {
        throw new GeoArtifactError(
          'manifest-unavailable',
          `geo manifest responded ${response.status}`,
        )
      }

      const parsed: unknown = await response.json()

      assertManifest(parsed)

      return parsed
    })
    .catch((error: unknown) => {
      manifestCache.delete(baseUrl)

      if (error instanceof GeoArtifactError) {
        throw error
      }

      throw new GeoArtifactError(
        'manifest-unavailable',
        error instanceof Error ? error.message : 'geo manifest could not be fetched',
      )
    })

  manifestCache.set(baseUrl, pending)

  return pending
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)

  const digest = await crypto.subtle.digest('SHA-256', buffer)

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function findArtifact(manifest: GeoManifest, name: string): GeoArtifact {
  const artifact = manifest.artifacts.find((entry) => entry.name === name)

  if (artifact !== undefined) {
    return artifact
  }

  const blocked = manifest.blocked.find((entry) => entry.name === name)

  if (blocked !== undefined) {
    throw new GeoArtifactError(
      'artifact-blocked',
      `geo artifact ${name} is withheld: ${blocked.detail}`,
    )
  }

  throw new GeoArtifactError('artifact-missing', `geo artifact ${name} is not in the manifest`)
}

export async function fetchGeoArtifact(
  manifest: GeoManifest,
  name: string,
  baseUrl = DEFAULT_BASE_URL,
): Promise<GeoArtifactBytes> {
  const artifact = findArtifact(manifest, name)
  const key = `${baseUrl}:${manifest.release}:${artifact.sha256}`
  const cached = artifactCache.get(key)

  if (cached !== undefined) {
    return cached
  }

  const pending = fetch(resolveArtifactUrl(artifact, baseUrl))
    .then(async (response) => {
      if (!response.ok) {
        throw new GeoArtifactError(
          'artifact-unavailable',
          `geo artifact ${name} responded ${response.status}`,
        )
      }

      const bytes = new Uint8Array(await response.arrayBuffer())
      const digest = await sha256Hex(bytes)

      if (digest !== artifact.sha256) {
        throw new GeoArtifactError(
          'checksum-mismatch',
          `geo artifact ${name} does not match release ${manifest.release}`,
        )
      }

      return { artifact, bytes }
    })
    .catch((error: unknown) => {
      artifactCache.delete(key)

      if (error instanceof GeoArtifactError) {
        throw error
      }

      throw new GeoArtifactError(
        'artifact-unavailable',
        error instanceof Error ? error.message : `geo artifact ${name} could not be fetched`,
      )
    })

  artifactCache.set(key, pending)

  return pending
}

export async function fetchGeoJson<T>(
  manifest: GeoManifest,
  name: string,
  baseUrl = DEFAULT_BASE_URL,
): Promise<{ artifact: GeoArtifact; data: T }> {
  const { artifact, bytes } = await fetchGeoArtifact(manifest, name, baseUrl)
  const text = new TextDecoder().decode(bytes)

  return { artifact, data: JSON.parse(text) as T }
}

export function clearGeoCache(): void {
  manifestCache.clear()
  artifactCache.clear()
}
