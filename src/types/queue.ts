import type { FloodLevel } from './report'

export type QueueItemKind = 'level'

export type QueueItemStatus =
  | 'queued'
  | 'syncing'
  | 'failed'
  | 'blocked'
  | 'auth-required'

export interface LevelReportPayload {
  flood_level: FloodLevel
  latitude: number
  longitude: number
  gps_accuracy: number | null
  notes: string | null
  reported_at: string | null
}

export interface QueueItem {
  id: string
  userId: number
  kind: QueueItemKind
  payload: LevelReportPayload
  photo: ArrayBuffer
  photoType: string
  photoName: string
  photoBytes: number
  status: QueueItemStatus
  attempts: number
  lastError: string | null
  nextAttemptAt: number | null
  createdAt: number
  observedAt: string
}

export type QueueOutcomeStatus =
  | 'sent'
  | 'merged'
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
