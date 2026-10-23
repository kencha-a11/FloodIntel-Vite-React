import type { UserRole } from './auth'

export type FloodLevel = 'ankle' | 'knee' | 'waist' | 'chest' | 'neck'

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
  flood_level: FloodLevel
  flood_level_label: string
  severity: number
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

export interface FloodReportInput {
  flood_level: FloodLevel
  latitude: number
  longitude: number
  gps_accuracy: number | null
  notes: string | null
  reported_at: string | null
}

export interface ReportFilters {
  flood_level: FloodLevel | ''
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
