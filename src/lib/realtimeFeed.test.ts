import { describe, expect, it } from 'vitest'
import {
  affectsValidatedFeed,
  authRefreshDelayMs,
  parseRealtimePayload,
} from './realtimeFeed'

const created = {
  id: 42,
  barangay_id: 3,
  status: 'submitted',
  changed: [],
}

describe('parseRealtimePayload', () => {
  it('accepts the declared created payload', () => {
    expect(parseRealtimePayload('report.created', created)).toEqual({
      event: 'report.created',
      reportId: 42,
      barangayId: 3,
      status: 'submitted',
      changed: [],
    })
  })

  it('accepts the declared status-change payload', () => {
    expect(
      parseRealtimePayload('report.status_changed', {
        ...created,
        status: 'rejected',
        changed: ['status'],
      }),
    ).toEqual({
      event: 'report.status_changed',
      reportId: 42,
      barangayId: 3,
      status: 'rejected',
      changed: ['status'],
    })
  })

  it('refuses an undeclared event name', () => {
    expect(parseRealtimePayload('report.deleted', created)).toBeNull()
  })

  it('refuses a payload with a field the contract does not carry', () => {
    expect(
      parseRealtimePayload('report.created', {
        ...created,
        latitude: 14.95,
      }),
    ).toBeNull()

    expect(
      parseRealtimePayload('report.created', {
        id: 42,
        barangay_id: 3,
        status: 'submitted',
      }),
    ).toBeNull()
  })

  it('refuses malformed identifiers and changed fields', () => {
    expect(parseRealtimePayload('report.created', { ...created, id: '42' })).toBeNull()
    expect(parseRealtimePayload('report.created', { ...created, id: 0 })).toBeNull()
    expect(
      parseRealtimePayload('report.created', { ...created, barangay_id: 1.5 }),
    ).toBeNull()
    expect(
      parseRealtimePayload('report.status_changed', { ...created, changed: 'status' }),
    ).toBeNull()
    expect(
      parseRealtimePayload('report.status_changed', { ...created, changed: [7] }),
    ).toBeNull()
    expect(
      parseRealtimePayload('report.created', { ...created, changed: ['status'] }),
    ).toBeNull()
  })

  it('refuses a payload that is not an object', () => {
    for (const payload of [null, 'created', 42, [created]]) {
      expect(parseRealtimePayload('report.created', payload)).toBeNull()
    }
  })
})

describe('affectsValidatedFeed', () => {
  it('reacts to a status transition because the feed is validated-only', () => {
    const update = parseRealtimePayload('report.status_changed', {
      ...created,
      status: 'validated',
      changed: ['status'],
    })

    expect(update).not.toBeNull()
    expect(update === null ? false : affectsValidatedFeed(update)).toBe(true)
  })

  it('ignores a new submission that is not validated yet', () => {
    const update = parseRealtimePayload('report.created', created)

    expect(update).not.toBeNull()
    expect(update === null ? false : affectsValidatedFeed(update)).toBe(false)
  })
})

describe('authRefreshDelayMs', () => {
  const now = Date.UTC(2026, 9, 31, 8, 0, 0)

  it('renews before the token expires', () => {
    const expiresAt = new Date(now + 600_000).toISOString()

    expect(authRefreshDelayMs(expiresAt, now)).toBe(480_000)
  })

  it('keeps a minimum delay and retries soon after expiry', () => {
    expect(authRefreshDelayMs(new Date(now + 3_000).toISOString(), now)).toBe(
      5_000,
    )
    expect(authRefreshDelayMs(new Date(now - 1_000).toISOString(), now)).toBe(
      5_000,
    )
  })

  it('falls back to a minute without a usable timestamp', () => {
    expect(authRefreshDelayMs(null, now)).toBe(60_000)
    expect(authRefreshDelayMs('not-a-date', now)).toBe(60_000)
  })
})
