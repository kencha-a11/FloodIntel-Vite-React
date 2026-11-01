import { afterEach, describe, expect, it, vi } from 'vitest'
import { submitImpactReport, submitReport } from './reportApi'
import type { ImpactReportInput } from '../types/impact'
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

async function impactBodyOf(report: ImpactReportInput): Promise<unknown> {
  let captured: unknown = null

  vi.stubGlobal(
    'fetch',
    vi.fn(async (_path: string, init: RequestInit = {}) => {
      captured = JSON.parse(String(init.body))

      return new Response(JSON.stringify({ data: { id: 1 } }), { status: 201 })
    }),
  )

  await submitImpactReport('token', report, 'queue-id')

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

describe('submitImpactReport', () => {
  const impact: ImpactReportInput = {
    event_id: 7,
    families: 12,
    individuals: 48,
    remarks: 'Two puroks flooded.',
    reported_at: '2026-11-01T08:00:00.000Z',
  }

  it('sends the queue id as the idempotency key', async () => {
    const body = (await impactBodyOf(impact)) as Record<string, unknown>

    expect(body.client_uuid).toBe('queue-id')
    expect(body.event_id).toBe(7)
    expect(body.families).toBe(12)
    expect(body.individuals).toBe(48)
  })

  it('sends the correction target when the item answers an earlier report', async () => {
    const body = (await impactBodyOf({
      ...impact,
      supersedes_id: 42,
    })) as Record<string, unknown>

    expect(body.supersedes_id).toBe(42)
    expect(body.client_uuid).toBe('queue-id')
  })
})
