import type { UserRole } from './auth'

export type FloodLevel = 'ankle' | 'knee' | 'waist' | 'chest' | 'neck'
export type AlertLevel = 'alert' | 'get_ready' | 'red_alert'
export type FloodType = 'river_overflow' | 'ponding'

export type FloodReportStatus = 'submitted' | 'validated' | 'returned' | 'rejected'

export interface FloodReportUser {
  id: number
  first_name: string
  last_name: string
  role: UserRole
}

export interface FloodReportBarangay {
  id: number
  name: string
}

export interface AnomalyFlag {
  value: string
  label: string
}

export interface FloodReportStatusChange {
  id: number
  actor_name: string
  actor_role: UserRole
  actor_role_label: string | null
  from_status: FloodReportStatus | null
  from_status_label: string | null
  to_status: FloodReportStatus
  to_status_label: string
  reason: string | null
  created_at: string
}

export interface Barangay {
  id: number
  name: string
  code: string
  is_active: boolean
}

/** The report a correction answers, as the detail and queue read it. */
export interface SupersededReportLink {
  id: number
  status: FloodReportStatus
  status_label: string
  reported_at: string | null
  returned_reason: string | null
}

export interface FloodReport {
  id: number
  user: FloodReportUser
  barangay: FloodReportBarangay
  flood_level: FloodLevel | null
  flood_level_label: string | null
  severity: number | null
  alert_level: AlertLevel | null
  alert_level_label: string | null
  alert_severity: number | null
  flood_type: FloodType | null
  flood_type_label: string | null
  depth_cm: number | null
  landmark: string | null
  latitude: number
  longitude: number
  gps_accuracy: number | null
  address: string | null
  photo_url: string
  notes: string | null
  reported_at: string | null
  status: FloodReportStatus
  status_label: string
  status_changes?: FloodReportStatusChange[]
  anomaly_flags: AnomalyFlag[]
  rejection_reason: string | null
  rejected_at: string | null
  /** FR-14's link, not a fifth status: the prior report keeps its own status. */
  supersedes_id: number | null
  superseded_by_id?: number | null
  supersedes?: SupersededReportLink | null
  created_at: string
}

export interface ValidatedFeedRow {
  id: number
  latitude: number
  longitude: number
  gps_accuracy: number | null
  barangay: FloodReportBarangay
  alert_level: AlertLevel
  alert_level_label: string
  alert_severity: number
  depth_cm: number | null
  observed_at: string
  received_at: string
  status: 'validated'
  status_label: string
  source: 'reported'
  source_label: string
}

export interface ValidatedFeedMeta {
  limit: number
  count: number
  truncated: boolean
}

export interface ValidatedFeedPage {
  data: ValidatedFeedRow[]
  meta: ValidatedFeedMeta
}

type FloodReportInputBase = {
  latitude: number
  longitude: number
  gps_accuracy: number | null
  notes: string | null
  reported_at: string | null
  supersedes_id?: number | null
}

export type FloodReportInput =
  | (FloodReportInputBase & {
      alert_level: AlertLevel
      flood_level?: never
      flood_type: FloodType
      depth_cm: number | null
      landmark: string | null
    })
  | (FloodReportInputBase & {
      alert_level?: never
      flood_level: FloodLevel
      flood_type?: FloodType | null
      depth_cm?: number | null
      landmark?: string | null
    })

export interface ReportFilters {
  q: string
  flood_level: FloodLevel | ''
  flood_type: FloodType | ''
  alert_level: AlertLevel | ''
  status: FloodReportStatus | ''
  barangay_id: number | ''
  from: string
  to: string
  per_page: number
  page: number
}

export interface Paginated<T> {
  data: T[]
  links: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
  meta: {
    current_page: number
    from: number | null
    last_page: number
    per_page: number
    to: number | null
    total: number
  }
}
