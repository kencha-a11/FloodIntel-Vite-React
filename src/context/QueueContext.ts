import { createContext } from 'react'
import type { LevelReportPayload, QueueItem, QueueOutcome } from '../types/queue'

export interface SubmitLevelReportInput {
  payload: LevelReportPayload
  observedAt: string
  photo: Blob
  photoName: string
}

export interface SubmitLevelReportResult {
  id: string
  queued: boolean
  failed: boolean
  reportId: number | null
  message: string
}

export interface QueueContextValue {
  items: QueueItem[]
  pendingCount: number
  online: boolean
  running: boolean
  authRequired: boolean
  authStale: boolean
  storageAvailable: boolean
  outcomes: QueueOutcome[]
  submitLevelReport: (
    input: SubmitLevelReportInput,
  ) => Promise<SubmitLevelReportResult>
  retry: (id: string) => Promise<void>
  retryAll: () => Promise<void>
  clearDeviceData: () => Promise<void>
  dismissOutcomes: () => void
  refresh: () => Promise<void>
}

export const QueueContext = createContext<QueueContextValue | null>(null)
