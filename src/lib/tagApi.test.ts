import { afterEach, describe, expect, it, vi } from 'vitest'
import { submitTag } from './tagApi'
import { API_BASE_URL } from './http'
import type { AccessTagInput } from '../types/accessTag'

const base: AccessTagInput = {
  type: 'narrow_alley',
  note: null,
  landmark: 'Sitio Balite footpath',
  latitude: 14.9512345,
  longitude: 120.8312345,
  gps_accuracy: 6.5,
  address: null,
  observed_at: '2026-11-02T09:10:00.000Z',
}

interface Captured {
  url: string
  init: RequestInit
}

function stubFetch(): () => Captured {
  let captured: Captured = { url: '', init: {} }

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      captured = { url, init }

      return new Response(JSON.stringify({ data: { id: 7 } }), { status: 201 })
    }),
  )

  return () => captured
}

function bodyOf(init: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init.body)) as Record<string, unknown>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('submitTag', () => {
  it('posts the capture fields and returns the stored tag', async () => {
    const read = stubFetch()
    const tag = await submitTag('token', base)
    const { url, init } = read()

    expect(tag.id).toBe(7)
    expect(url).toBe(`${API_BASE_URL}/access-tags`)
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('Content-Type')).toBe(
      'application/json',
    )
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token')
    expect(bodyOf(init)).toMatchObject({
      type: 'narrow_alley',
      latitude: 14.9512345,
      longitude: 120.8312345,
      gps_accuracy: 6.5,
      landmark: 'Sitio Balite footpath',
      observed_at: '2026-11-02T09:10:00.000Z',
    })
  })

  it('omits the optional fields a capture left empty', async () => {
    const read = stubFetch()

    await submitTag('token', {
      ...base,
      note: null,
      landmark: null,
      gps_accuracy: null,
      address: null,
    })

    const body = bodyOf(read().init)

    for (const field of ['note', 'landmark', 'gps_accuracy', 'address']) {
      expect(body).not.toHaveProperty(field)
    }
  })

  it('sends no client key because a duplicate tag is an accepted risk', async () => {
    const read = stubFetch()

    await submitTag('token', base)

    expect(bodyOf(read().init)).not.toHaveProperty('client_uuid')
  })
})
