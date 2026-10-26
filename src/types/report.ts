import type { UserRole } from './auth'

export type FloodLevel = 'ankle' | 'knee' | 'waist' | 'chest' | 'neck'
export type AlertLevel = 'alert' | 'get_ready' | 'red_alert'
export type FloodType = 'river_overflow' | 'ponding'

export type FloodReportStatus = 'submitted' | 'rejected'

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

export interface Barangay {
  id: number
  name: string
  code: string
  is_active: boolean
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
  reported_at: string
  status: FloodReportStatus
  rejection_reason: string | null
  rejected_at: string | null
  created_at: string
}

type FloodReportInputBase = {
  latitude: number
  longitude: number
  gps_accuracy: number | null
  notes: string | null
  reported_at: string | null
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
  flood_level: FloodLevel | ''
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
