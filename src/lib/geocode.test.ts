import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearGeocodeCache, geocodeKey, reverseGeocode } from './geocode'

function jsonResponse(address: string | null, status = 200): Response {
  return new Response(JSON.stringify({ data: { address } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('geocode', () => {
  beforeEach(() => {
    clearGeocodeCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rounds coordinates to five decimal places for the cache key', () => {
    expect(geocodeKey(14.5995001, 120.9842001)).toBe('14.59950:120.98420')
  })

  it('returns and caches a resolved address', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse('Mabini Street')))
    vi.stubGlobal('fetch', fetchMock)

    await expect(reverseGeocode('token', 14.5995, 120.9842)).resolves.toBe(
      'Mabini Street',
    )
    await expect(reverseGeocode('token', 14.5995, 120.9842)).resolves.toBe(
      'Mabini Street',
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('deduplicates concurrent lookups for the same coordinates', async () => {
    let resolveFetch: (response: Response) => void = () => {}
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const first = reverseGeocode('token', 14.5995, 120.9842)
    const second = reverseGeocode('token', 14.5995, 120.9842)

    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFetch(jsonResponse('Mabini Street'))

    await expect(first).resolves.toBe('Mabini Street')
    await expect(second).resolves.toBe('Mabini Street')
  })

  it('returns null and does not cache provider errors', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(null, 503)),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      reverseGeocode('token', 14.5995, 120.9842),
    ).resolves.toBeNull()
    await expect(
      reverseGeocode('token', 14.5995, 120.9842),
    ).resolves.toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns null when the network request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    )

    await expect(
      reverseGeocode('token', 14.5995, 120.9842),
    ).resolves.toBeNull()
  })

  it('does not call the API without a token', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(reverseGeocode('', 14.5995, 120.9842)).resolves.toBeNull()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
