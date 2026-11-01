import { enqueue, getQueueItem } from './offlineQueue'
import { syncQueue } from './sync'
import type { SyncSummary } from './sync'
import type { QueueItem, SubmitReportResult } from '../types/queue'

export interface DeliveryDeps {
  enqueue: (item: QueueItem, replaceId?: string) => Promise<void>
  get: (id: string) => Promise<QueueItem | null>
  sync: (userId: number) => Promise<SyncSummary>
  online: () => boolean
}

export function createDeliveryDeps(): DeliveryDeps {
  return {
    enqueue,
    get: getQueueItem,
    sync: (userId) => syncQueue(userId),
    online: () =>
      typeof navigator === 'undefined' ? true : navigator.onLine,
  }
}

// A rejected attempt keeps its queue record: that record is the reporter's
// only copy of the photo and the capture instant (FR-19). Only a confirmed
// discard deletes one. A resubmission replaces the attempt it grew from
// (`replaceId`), so fixing a rejected payload does not queue a second photo.
export async function deliverQueuedItem(
  item: QueueItem,
  replaceId: string | undefined,
  deps: DeliveryDeps = createDeliveryDeps(),
): Promise<SubmitReportResult> {
  await deps.enqueue(item, replaceId)

  const summary = await deps.sync(item.userId)
  let outcome = summary.outcomes.find((entry) => entry.id === item.id)

  // A repair leaves the record queued for an immediate retry (D-107), and a
  // photo rescue does the same, so a "queued" outcome still means the pass has
  // work it has not attempted yet. One more pass sends it; a record scheduled
  // for later is skipped by the engine and keeps its first message.
  const retryable = outcome === undefined || outcome.status === 'queued'

  if (retryable && summary.remaining > 0 && deps.online()) {
    const retrySummary = await deps.sync(item.userId)
    const retried = retrySummary.outcomes.find((entry) => entry.id === item.id)

    if (retried !== undefined) {
      outcome = retried
    }
  }

  const remaining = await deps.get(item.id)

  return {
    id: item.id,
    queued: remaining !== null,
    failed: outcome?.status === 'failed',
    reportId: outcome?.reportId ?? null,
    message:
      outcome?.message ??
      (remaining !== null
        ? 'Saved on this device. It will send automatically when online.'
        : 'Report sent.'),
  }
}
