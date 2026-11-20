import { describe, expect, it } from 'vitest'
import {
  buildPayload,
  isBarangayScoped,
  normalizePayloadKey,
  payloadViolations,
  sectionLabel,
  sectionMeta,
  SITREP_SECTIONS,
} from './sitrepSections'

describe('section metadata', () => {
  it('names all twelve sections of the adapted template', () => {
    expect(SITREP_SECTIONS.map((entry) => entry.value)).toEqual([
      'weather',
      'station',
      'lifeline',
      'evacuation',
      'evacuees',
      'households',
      'casualties',
      'damaged_houses',
      'damage_costs',
      'other_incidents',
      'assistance',
      'actions',
    ])
  })

  it('scopes exactly the barangay-level sections', () => {
    const scoped = SITREP_SECTIONS.filter((entry) => entry.barangayScoped).map(
      (entry) => entry.value,
    )

    expect(scoped).toEqual([
      'evacuation',
      'evacuees',
      'households',
      'casualties',
      'damaged_houses',
    ])
    expect(isBarangayScoped('casualties')).toBe(true)
    expect(isBarangayScoped('weather')).toBe(false)
  })

  it('labels a section and refuses an unknown one', () => {
    expect(sectionLabel('damage_costs')).toBe('Damage costs')
    expect(sectionMeta('lifeline').fields.map((field) => field.key)).toContain('kind')
    expect(() => sectionMeta('nope' as never)).toThrow()
  })
})

describe('normalizePayloadKey', () => {
  it('lowercases and strips everything but letters and digits', () => {
    expect(normalizePayloadKey('Full_Name')).toBe('fullname')
    expect(normalizePayloadKey('GPS Latitude')).toBe('gpslatitude')
    expect(normalizePayloadKey('dead')).toBe('dead')
  })
})

describe('payloadViolations', () => {
  it('accepts an aggregate-only payload', () => {
    expect(payloadViolations({ dead: 2, injured: 5 })).toEqual([])
    expect(payloadViolations({ families: 10, persons: 40, centers: 2 })).toEqual([])
  })

  it('refuses an individual identity key, however it is spelled', () => {
    expect(payloadViolations({ full_name: 'Juan' })).toEqual(['payload.full_name'])
    expect(payloadViolations({ 'Full Name': 'Juan' })).toEqual(['payload.Full Name'])
    expect(payloadViolations({ latitude: 14.6 })).toEqual(['payload.latitude'])
    expect(payloadViolations({ photo: 'x.jpg' })).toEqual(['payload.photo'])
  })

  it('walks nested objects and arrays', () => {
    expect(
      payloadViolations({ households: [{ name: 'Juan' }, { families: 3 }] }),
    ).toEqual(['payload.households[0].name'])
    expect(payloadViolations({ meta: { address: 'Purok 1' } })).toEqual([
      'payload.meta.address',
    ])
  })

  it('does not mistake an aggregate figure for an identity', () => {
    expect(payloadViolations({ inside: 12, outside: 4, partial: 3, total: 1 })).toEqual([])
  })
})

describe('buildPayload', () => {
  it('drops empty entries so a missing figure stays absent, never zero', () => {
    const payload = buildPayload('casualties', { dead: '2', injured: '' })

    expect(payload).toEqual({ dead: 2 })
    expect('injured' in payload).toBe(false)
  })

  it('coerces number fields and keeps text fields as text', () => {
    expect(buildPayload('evacuees', { inside: '12', outside: '4' })).toEqual({
      inside: 12,
      outside: 4,
    })
    expect(buildPayload('weather', { summary: '  Habagat  ' })).toEqual({
      summary: 'Habagat',
    })
  })

  it('ignores keys the section does not define', () => {
    expect(buildPayload('actions', { action: 'Deployed a team', stray: 'x' })).toEqual({
      action: 'Deployed a team',
    })
  })
})