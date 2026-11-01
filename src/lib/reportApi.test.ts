import { afterEach, describe, expect, it, vi } from 'vitest'
import { submitReport } from './reportApi'
import type { FloodReportInput } from '../types/report'

const base: FloodReportInput = {
  alert_level: 'alert',
  flood_type: 'ponding',
  depth_cm: 30,
  landmark: null,
  latitude: 14.5995,
  longitude: 120.9842,
  gps_accuracy: 8,
  notes: null,
  reported_at: '2026-11-01T08:00:00.000Z',
}

async function formOf(report: FloodReportInput): Promise<FormData> {
  let captured: FormData | null = null

  vi.stubGlobal(
    'fetch',
    vi.fn(async (_path: string, init: RequestInit = {}) => {
      captured = init.body as FormData

      return new Response(JSON.stringify({ data: { id: 1 } }), { status: 201 })
    }),
  )

  await submitReport(
    'token',
    report,
    new Blob(['photo'], { type: 'image/jpeg' }),
    'queue-id',
  )

  if (captured === null) {
    throw new Error('submitReport sent no form.')
  }

  return captured
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('submitReport', () => {
  it('sends the correction target so the server can link the new report', async () => {
    const form = await formOf({ ...base, supersedes_id: 42 })

    expect(form.get('supersedes_id')).toBe('42')
    expect(form.get('client_uuid')).toBe('queue-id')
    expect(form.get('alert_level')).toBe('alert')
  })

  it('omits the link for a new report', async () => {
    expect((await formOf({ ...base, supersedes_id: null })).has('supersedes_id')).toBe(
      false,
    )
    expect((await formOf({ ...base })).has('supersedes_id')).toBe(false)
  })
})
