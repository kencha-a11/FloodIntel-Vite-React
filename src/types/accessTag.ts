import type { UserRole } from './auth'

/** FR-112's closed taxonomy; display text comes from the server's `type_label`. */
export type AccessTagType =
  | 'narrow_alley'
  | 'no_vehicle_access'
  | 'stairs_or_steep'
  | 'structurally_blocked'
  | 'other'

/** The capture payload the queue stores and transmits (FR-114). */
export interface AccessTagInput {
  type: AccessTagType
  note: string | null
  landmark: string | null
  latitude: number
  longitude: number
  gps_accuracy: number | null
  address: string | null
  observed_at: string
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
  type: AccessTagType
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
