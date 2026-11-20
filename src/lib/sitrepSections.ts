import type { SitrepSection } from '../types/sitrep'

/*
 * The one place the client names the SITREP sections and the fields each
 * supplement carries (D-147). It mirrors the server's SitrepSection enum and
 * the payload keys the frozen document reads, so a draft typed here renders
 * into the matching template slot. The privacy guard mirrors
 * SitrepPayloadGuard: the server refuses these keys again, and a blocked
 * draft here is never evidence that the server would accept it (D-08, D-45).
 */

export interface SitrepFieldOption {
  value: string
  label: string
}

export interface SitrepField {
  key: string
  label: string
  type: 'text' | 'number' | 'textarea' | 'select'
  options?: SitrepFieldOption[]
  hint?: string
}

export interface SitrepSectionMeta {
  value: SitrepSection
  label: string
  barangayScoped: boolean
  fields: SitrepField[]
}

const LIFELINE_KINDS: SitrepFieldOption[] = [
  { value: 'roads_bridges', label: 'Roads and bridges' },
  { value: 'power', label: 'Power' },
  { value: 'communications', label: 'Communications' },
  { value: 'water_supply', label: 'Water supply' },
]

export const SITREP_SECTIONS: readonly SitrepSectionMeta[] = [
  {
    value: 'weather',
    label: 'Weather',
    barangayScoped: false,
    fields: [
      {
        key: 'summary',
        label: 'Weather summary',
        type: 'textarea',
        hint: 'Synoptic situation and forecast for the window.',
      },
    ],
  },
  {
    value: 'station',
    label: 'Station / water level',
    barangayScoped: false,
    fields: [
      { key: 'station', label: 'Station', type: 'text' },
      { key: 'reading', label: 'Reading', type: 'text' },
      { key: 'unit', label: 'Unit', type: 'text', hint: 'e.g. m, m/s' },
      { key: 'status', label: 'Status', type: 'text', hint: 'e.g. above critical' },
    ],
  },
  {
    value: 'lifeline',
    label: 'Lifelines',
    barangayScoped: false,
    fields: [
      { key: 'kind', label: 'Lifeline', type: 'select', options: LIFELINE_KINDS },
      { key: 'asset', label: 'Asset / line', type: 'text' },
      { key: 'status', label: 'Status', type: 'text', hint: 'e.g. passable, out' },
      { key: 'location', label: 'Location', type: 'text' },
    ],
  },
  {
    value: 'evacuation',
    label: 'Pre-emptive evacuation',
    barangayScoped: true,
    fields: [
      { key: 'families', label: 'Families', type: 'number' },
      { key: 'persons', label: 'Persons', type: 'number' },
      { key: 'centers', label: 'Evacuation centers', type: 'number' },
    ],
  },
  {
    value: 'evacuees',
    label: 'Evacuees',
    barangayScoped: true,
    fields: [
      { key: 'inside', label: 'Inside centers', type: 'number' },
      { key: 'outside', label: 'Outside centers', type: 'number' },
    ],
  },
  {
    value: 'households',
    label: 'Households',
    barangayScoped: true,
    fields: [
      { key: 'families', label: 'Families', type: 'number' },
      { key: 'persons', label: 'Persons', type: 'number' },
    ],
  },
  {
    value: 'casualties',
    label: 'Casualties (aggregate)',
    barangayScoped: true,
    fields: [
      { key: 'dead', label: 'Dead (persons)', type: 'number' },
      { key: 'injured', label: 'Injured (persons)', type: 'number' },
    ],
  },
  {
    value: 'damaged_houses',
    label: 'Damaged houses',
    barangayScoped: true,
    fields: [
      { key: 'partial', label: 'Partially damaged', type: 'number' },
      { key: 'total', label: 'Totally damaged', type: 'number' },
    ],
  },
  {
    value: 'damage_costs',
    label: 'Damage costs',
    barangayScoped: false,
    fields: [
      { key: 'category', label: 'Category', type: 'text', hint: 'e.g. agriculture, infrastructure' },
      { key: 'currency', label: 'Currency', type: 'text', hint: 'Defaults to PHP.' },
      { key: 'amount', label: 'Amount', type: 'text' },
      { key: 'estimate_status', label: 'Estimate status', type: 'text', hint: 'e.g. preliminary, validated' },
    ],
  },
  {
    value: 'other_incidents',
    label: 'Other incidents',
    barangayScoped: false,
    fields: [
      { key: 'incident', label: 'Incident', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
    ],
  },
  {
    value: 'assistance',
    label: 'Assistance',
    barangayScoped: false,
    fields: [
      { key: 'agency', label: 'Agency', type: 'text' },
      { key: 'kind', label: 'Assistance', type: 'text', hint: 'e.g. relief goods, medical' },
      { key: 'remarks', label: 'Remarks', type: 'textarea' },
    ],
  },
  {
    value: 'actions',
    label: 'Actions taken',
    barangayScoped: false,
    fields: [
      { key: 'action', label: 'Action', type: 'textarea' },
    ],
  },
]

export function sectionMeta(section: SitrepSection): SitrepSectionMeta {
  const meta = SITREP_SECTIONS.find((entry) => entry.value === section)

  if (meta === undefined) {
    throw new Error(`Unknown SITREP section: ${section}`)
  }

  return meta
}

export function sectionLabel(section: SitrepSection): string {
  return sectionMeta(section).label
}

export function isBarangayScoped(section: SitrepSection): boolean {
  return sectionMeta(section).barangayScoped
}

/*
 * The disallowed key list, normalized the same way the server normalizes it:
 * lowercase, stripped of everything but letters and digits. A payload key
 * that normalizes to one of these carries an individual identity and is
 * refused before it ever leaves the device (D-45, amended 2026-11-18).
 */
const DISALLOWED_KEYS: readonly string[] = [
  'name', 'names', 'fullname', 'firstname', 'lastname', 'middlename',
  'gender', 'sex', 'age', 'ages', 'birthdate', 'birthday',
  'address', 'addresses', 'street', 'purok', 'sitio', 'householdid',
  'latitude', 'longitude', 'lat', 'lng', 'lon', 'coordinates', 'coordinate',
  'photo', 'photos', 'picture', 'pictures', 'image', 'images',
  'victim', 'victims', 'resident', 'residents',
  'casualtyname', 'causeofdeath', 'causeofinjury',
]

export function normalizePayloadKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Returns the offending payload paths, or an empty list when the payload is
 * aggregate-only. Walks nested objects and arrays like the server guard.
 */
export function payloadViolations(
  payload: Record<string, unknown>,
  prefix = 'payload',
): string[] {
  const violations: string[] = []

  for (const [key, value] of Object.entries(payload)) {
    const path = `${prefix}.${key}`

    if (DISALLOWED_KEYS.includes(normalizePayloadKey(key))) {
      violations.push(path)
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (isRecord(item)) {
          violations.push(...payloadViolations(item, `${path}[${index}]`))
        }
      })
    } else if (isRecord(value)) {
      violations.push(...payloadViolations(value, path))
    }
  }

  return violations
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Build a payload from the section's field values, dropping empty entries so
 * a missing figure stays absent (rendered "Unavailable"), never zero.
 */
export function buildPayload(
  section: SitrepSection,
  values: Record<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  for (const field of sectionMeta(section).fields) {
    const raw = (values[field.key] ?? '').trim()

    if (raw === '') {
      continue
    }

    payload[field.key] = field.type === 'number' ? Number(raw) : raw
  }

  return payload
}