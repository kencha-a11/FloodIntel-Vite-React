import { API_BASE_URL, request } from './http'

const CACHE_LIMIT = 50
const TIMEOUT_MS = 5_000

const cache = new Map<string, string>()
const inFlight = new Map<string, Promise<string | null>>()

export function geocodeKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}:${longitude.toFixed(5)}`
}

export function reverseGeocode(
  token: string,
  latitude: number,
  longitude: number,
): Promise<string | null> {
  if (token === '') {
    return Promise.resolve(null)
  }

  const key = geocodeKey(latitude, longitude)
  const cached = cache.get(key)

  if (cached !== undefined) {
    return Promise.resolve(cached)
  }

  const pending = inFlight.get(key)

  if (pending !== undefined) {
    return pending
  }

  const query = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  })

  const promise = request<{ data: { address: string | null } }>(
    `${API_BASE_URL}/geocode/reverse?${query.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
    TIMEOUT_MS,
  )
    .then((response) => {
      const address = response.data.address

      if (address === null || address === '') {
        return null
      }

      if (cache.size >= CACHE_LIMIT) {
        const oldest = cache.keys().next().value

        if (oldest !== undefined) {
          cache.delete(oldest)
        }
      }

      cache.set(key, address)

      return address
    })
    .catch(() => null)
    .finally(() => {
      inFlight.delete(key)
    })

  inFlight.set(key, promise)

  return promise
}

export function clearGeocodeCache(): void {
  cache.clear()
  inFlight.clear()
}
