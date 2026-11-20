import type { ImpactEvent } from './impact'

/*
 * The command-center SITREP surface (D-42, D-43, D-147). These shapes mirror
 * the server resources; the client renders what the server froze and never
 * re-derives a figure. Every timestamp is an ISO instant from the server.
 */

export type SitrepSection =
  | 'weather'
  | 'station'
  | 'lifeline'
  | 'evacuation'
  | 'evacuees'
  | 'households'
  | 'casualties'
  | 'damaged_houses'
  | 'damage_costs'
  | 'other_incidents'
  | 'assistance'
  | 'actions'

export interface SitrepIssuance {
  report_number: number
  issued_by_name: string
  issued_by_role: string
  office: Record<string, string>
  issued_at: string
}

export interface SitrepInclusion {
  flood_report_id: number
  barangay_id: number
  alert_level: string | null
  flood_level: string | null
  observed_at: string | null
  validated_at: string | null
}

export interface SitrepBarangayRow {
  barangay_id: number
  barangay: string
  alert_level: string | null
  flood_level: string | null
  affected_families: number | null
  affected_individuals: number | null
  [key: string]: unknown
}

export interface SitrepStageTwo {
  available: boolean
  basis?: string | null
  reason?: string | null
  affected_families: number | null
  affected_individuals: number | null
  [key: string]: unknown
}

export interface SituationalReport {
  id: number
  event_id: number | null
  window_starts_at: string
  window_ends_at: string
  cutoff_at: string
  cutoff_label: string
  timezone: string
  snapshot_at: string
  revision: number
  predecessor_id: number | null
  format_version: string
  generated_by_name: string
  generated_by_role: string
  status_counts: Record<string, number>
  totals: Record<string, unknown>
  latency: Record<string, unknown>
  barangays: SitrepBarangayRow[]
  stage_two: SitrepStageTwo
  content: Record<string, unknown> | null
  issuance?: SitrepIssuance | null
  inclusions?: SitrepInclusion[]
  created_at: string
}

export interface SitrepSupplement {
  id: number
  event_id: number
  section: SitrepSection
  barangay_id: number | null
  barangay?: string | null
  payload: Record<string, unknown>
  source: string | null
  observed_at: string | null
  created_by_name: string
  created_at: string
  updated_at: string
}

export interface SitrepSupplementInput {
  event_id: number
  section: SitrepSection
  barangay_id?: number | null
  payload: Record<string, unknown>
  source?: string | null
  observed_at?: string | null
}

export type SitrepRunState = 'prepared' | 'failed' | 'pending' | 'not_run'

export interface SitrepRunStatusRow {
  cutoff_at: string
  cutoff_label: string
  state: SitrepRunState
  reason: string | null
  situational_report_id: number | null
  triggered_by: string | null
  actor_name: string | null
  recorded_at: string | null
}

export type SitrepEvent = ImpactEvent