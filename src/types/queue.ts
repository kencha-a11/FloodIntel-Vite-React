import type { AccessTagInput } from './accessTag'
import type { AlertLevel, FloodLevel, FloodType } from './report'

export type QueueItemKind = 'level' | 'impact' | 'tag'

export type QueueItemStatus =
  | 'queued'
  | 'syncing'
  | 'failed'
  | 'blocked'
  | 'auth-required'

export interface LevelReportPayload {
  flood_level: FloodLevel | null
  alert_level?: AlertLevel | null
  flood_type?: FloodType | null
  depth_cm?: number | null
  landmark?: string | null
  latitude: number
  longitude: number
  gps_accuracy: number | null
  notes: string | null
  reported_at: string | null
  supersedes_id?: number | null
}

export interface ImpactReportPayload {
  event_id: number
  families: number
  individuals: number
  breakdown?: Record<string, number> | null
  related_level_report_ids?: number[] | null
  remarks: string | null
  reported_at: string | null
  supersedes_id?: number | null
}

export type ReportPayload = LevelReportPayload | ImpactReportPayload

interface QueueItemBase {
  id: string
  userId: number
  status: QueueItemStatus
  attempts: number
  lastError: string | null
  nextAttemptAt: number | null
  createdAt: number
  observedAt: string
  clockSkewMs?: number | null
}

/** Only a level report carries a photograph; impact reports and tags do not. */
export interface PhotoQueueFields {
  photo: ArrayBuffer
  photoType: string
  photoName: string
  photoBytes: number
}

export interface LevelQueueItem extends QueueItemBase, PhotoQueueFields {
  kind: 'level'
  payload: LevelReportPayload
}

export interface ImpactQueueItem extends QueueItemBase {
  kind: 'impact'
  payload: ImpactReportPayload
}

export interface TagQueueItem extends QueueItemBase {
  kind: 'tag'
  payload: AccessTagInput
}

export type QueueItem = LevelQueueItem | ImpactQueueItem | TagQueueItem

export type QueueItemPatch = Partial<QueueItemBase> &
  Partial<PhotoQueueFields> & {
    payload?: ReportPayload | AccessTagInput
  }

export type QueueOutcomeStatus =
  | 'sent'
  | 'queued'
  | 'failed'
  | 'auth-required'
  | 'blocked'

export interface QueueOutcome {
  id: string
  status: QueueOutcomeStatus
  message: string
  reportId: number | null
  at: number
}

export interface SubmitReportResult {
  id: string
  queued: boolean
  failed: boolean
  reportId: number | null
  message: string
}
