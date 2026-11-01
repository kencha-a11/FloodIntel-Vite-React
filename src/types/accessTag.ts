import type { UserRole } from './auth'

/** The capture payload the queue stores and transmits (FR-114). */
export interface AccessTagInput {
  // A string, not a union: the closed set lives in the server's enum, and a
  // new value must not require a client release (FR-112, NFR-42).
  type: string
  note: string | null
  landmark: string | null
  latitude: number
  longitude: number
  gps_accuracy: number | null
  address: string | null
  observed_at: string
}

/** One published taxonomy value with the label an interface renders (NFR-42). */
export interface AccessTagTypeOption {
  value: string
  label: string
  requires_note: boolean
}

/** One account as a tag names it, live or retired (FR-114, FR-121). */
export interface AccessTagActor {
  id: number
  first_name: string
  last_name: string
  role: UserRole
}

/** The stored tag as `AccessTagResource` returns it. */
export interface AccessTag {
  id: number
  barangay: { id: number; name: string }
  recorded_by: AccessTagActor
  type: string
  type_label: string
  landmark: string | null
  note: string | null
  latitude: number
  longitude: number
  gps_accuracy: number | null
  address: string | null
  observed_at: string
  is_active: boolean
  retired_at: string | null
  retired_reason: string | null
  retired_by: AccessTagActor | null
  created_at: string
}

/**
 * The list's filter surface (FR-120). An empty string means "not narrowed",
 * and `is_active` travels as the query string the server validates.
 */
export interface AccessTagFilters {
  barangay_id: string
  type: string
  is_active: '' | '1' | '0'
  from: string
  to: string
  per_page: number
  page: number
}
