import { createContext } from 'react'
import type { AccessTagInput } from '../types/accessTag'
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
  /** False until the first read of this user's saved records settles. */
  loaded: boolean
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
  /**
   * Queues a tag that carries its own capture instant, so the item and the
   * payload can never disagree about when the place was observed (FR-117).
   */
  submitTag: (payload: AccessTagInput) => Promise<SubmitReportResult>
  retry: (id: string) => Promise<void>
  retryAll: () => Promise<void>
  discard: (id: string) => Promise<void>
  clearDeviceData: () => Promise<void>
  dismissOutcomes: () => void
  refresh: () => Promise<void>
}

export const QueueContext = createContext<QueueContextValue | null>(null)
