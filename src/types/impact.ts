export interface FloodImpactReport {
  id: number
  user_id: number
  barangay_id: number
  event_id: number
  families: number
  individuals: number
  breakdown?: Record<string, number> | null
  related_level_report_ids?: number[] | null
  remarks: string | null
  reported_at: string | null
  status: string
  supersedes_id: number | null
  created_at: string
}

export interface ImpactReportInput {
  event_id: number
  families: number
  individuals: number
  breakdown?: Record<string, number> | null
  related_level_report_ids?: number[] | null
  remarks: string | null
  reported_at: string | null
}

export type ImpactStatus = 'submitted' | 'superseded'

export interface ImpactEvent {
  id: number
  title: string
  description?: string | null
  starts_at: string
  ends_at?: string | null
  is_closed: boolean
}