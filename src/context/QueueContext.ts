import { createContext } from 'react'
import type {
  ImpactReportPayload,
  LevelReportPayload,
  QueueItem,
  QueueOutcome,
  SubmitReportResult,
} from '../types/queue'

export interface SubmitLevelReportInput {
  payload: LevelReportPayload
  observedAt: string
  photo: Blob
  photoName: string
  replaceQueueId?: string
}

export interface SubmitImpactReportInput {
  payload: ImpactReportPayload
  observedAt: string
  replaceQueueId?: string
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
  ) => Promise<SubmitReportResult>
  submitImpactReport: (
    input: SubmitImpactReportInput,
  ) => Promise<SubmitReportResult>
  retry: (id: string) => Promise<void>
  retryAll: () => Promise<void>
  discard: (id: string) => Promise<void>
  clearDeviceData: () => Promise<void>
  dismissOutcomes: () => void
  refresh: () => Promise<void>
}

export const QueueContext = createContext<QueueContextValue | null>(null)
