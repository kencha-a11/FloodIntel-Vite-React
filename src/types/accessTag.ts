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

/** The stored tag as `AccessTagResource` returns it. */
export interface AccessTag {
  id: number
  barangay: { id: number; name: string }
  recorded_by: {
    id: number
    first_name: string
    last_name: string
    role: UserRole
  }
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
  created_at: string
}
