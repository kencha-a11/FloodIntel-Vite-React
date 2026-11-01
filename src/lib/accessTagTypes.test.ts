import { afterEach, describe, expect, it, vi } from 'vitest'
import { listAccessTagTypes, readCachedAccessTagTypes } from './accessTagTypes'
import { API_BASE_URL } from './http'
import type { AccessTagTypeOption } from '../types/accessTag'

/*
 * NFR-42: the client renders the server's vocabulary and keeps no copy of its
 * own; D-129 caches the published list so an offline capture can still label
 * the step. These cases pin the read, the cache, and the refusal of a list the
 * client cannot trust.
 */

const PUBLISHED: AccessTagTypeOption[] = [
  { value: 'foot_only', label: 'Foot only', requires_note: false },
  { value: 'unlisted', label: 'Unlisted constraint', requires_note: true },
]

function memoryStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear: () => {
      store.clear()
    },
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
}

interface Captured {
  url: string
  init: RequestInit
}

function stubFetch(body: unknown): () => Captured {
  let captured: Captured = { url: '', init: {} }

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      captured = { url, init }

      return new Response(JSON.stringify(body), { status: 200 })
    }),
  )

  return () => captured
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listAccessTagTypes', () => {
  it('reads the published vocabulary with the bearer token', async () => {
    vi.stubGlobal('localStorage', memoryStorage())
    const read = stubFetch({ data: PUBLISHED })

    const options = await listAccessTagTypes('token')

    expect(options).toEqual(PUBLISHED)
    expect(read().url).toBe(`${API_BASE_URL}/access-tags/types`)
    expect(new Headers(read().init.headers).get('Authorization')).toBe(
      'Bearer token',
    )
  })

  it('caches the list so a later offline read still has labels', async () => {
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)
    stubFetch({ data: PUBLISHED })

    await listAccessTagTypes('token')

    expect(readCachedAccessTagTypes()).toEqual(PUBLISHED)
  })

  it('replaces the cached list when the server publishes a new one', async () => {
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)
    storage.setItem(
      'access_tag_types',
      JSON.stringify([{ value: 'old', label: 'Old', requires_note: false }]),
    )
    stubFetch({ data: PUBLISHED })

    await listAccessTagTypes('token')

    expect(readCachedAccessTagTypes()).toEqual(PUBLISHED)
  })

  it('refuses a list it cannot trust and leaves the cache as it was', async () => {
    vi.stubGlobal('localStorage', memoryStorage())
    stubFetch({ data: [{ value: 'foot_only', label: 'Foot only' }] })

    await expect(listAccessTagTypes('token')).rejects.toThrow()
    expect(readCachedAccessTagTypes()).toBeNull()
  })
})

describe('readCachedAccessTagTypes', () => {
  it('answers null when this device has never loaded the list', () => {
    vi.stubGlobal('localStorage', memoryStorage())

    expect(readCachedAccessTagTypes()).toBeNull()
  })

  it('ignores a malformed or empty cache instead of throwing', () => {
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)

    for (const raw of ['{not json', '[]', '{"value":"foot_only"}']) {
      storage.setItem('access_tag_types', raw)
      expect(readCachedAccessTagTypes()).toBeNull()
    }
  })

  it('drops a cache where one entry is not a published option', () => {
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)
    storage.setItem(
      'access_tag_types',
      JSON.stringify([PUBLISHED[0], { value: 'foot_only', label: 'Foot only' }]),
    )

    expect(readCachedAccessTagTypes()).toBeNull()
  })
})
