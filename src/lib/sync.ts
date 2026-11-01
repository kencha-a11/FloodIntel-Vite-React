import {
  AuthApiError,
  NetworkTimeoutError,
  getStoredToken,
} from './http'
import { compressPhoto } from './photo'
import {
  LAST_RESORT_PHOTO_BYTES,
  RESCUE_PHOTO_BYTES,
} from './floodLevels'
import * as reportApi from './reportApi'
import * as tagApi from './tagApi'
import {
  listQueue,
  removeQueueItem,
  updateQueueItem,
} from './offlineQueue'
import { isSyncWindowExpired, readLastAuthenticatedAt } from './session'
import type { FloodReportInput } from '../types/report'
import type {
  LevelQueueItem,
  QueueItem,
  QueueItemPatch,
  QueueOutcome,
} from '../types/queue'

const BACKOFF_MS = [
  15_000,
  60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
]

// A sustained failure gets eight contacts before the ladder stops; the record
// stays with its photo and the reporter chooses Retry or Discard (D-109).
export const MAX_AUTO_ATTEMPTS = 8

const BACKOFF_JITTER_RATIO = 0.2

const BLOCKED_RETRY_MS = 60 * 60_000

const SEND_INTERVAL_MS = 6_000

export interface SyncSummary {
  sent: number
  failed: number
  remaining: number
  authRequired: boolean
  authStale: boolean
  outcomes: QueueOutcome[]
}

export interface SyncDeps {
  getToken: () => string | null
  getLastAuthenticatedAt: () => number | null
  now: () => number
  sleep: (ms: number) => Promise<void>
  list: (userId: number) => Promise<QueueItem[]>
  update: (
    id: string,
    patch: QueueItemPatch,
  ) => Promise<QueueItem | null>
  remove: (id: string) => Promise<void>
  send: (token: string, item: QueueItem) => Promise<{ id: number }>
  sendIntervalMs: number
  compressPhoto?: typeof compressPhoto
  random?: () => number
}

export interface SyncOptions {
  force?: boolean
}

// Jitter spreads a room of devices off the same rung so a returning
// connection does not deliver every queued photo at once (D-109).
export function backoffDelay(
  attempts: number,
  random: () => number = Math.random,
): number {
  const index = Math.min(Math.max(attempts, 1), BACKOFF_MS.length) - 1
  const base = BACKOFF_MS[index]
  const factor =
    1 - BACKOFF_JITTER_RATIO + random() * BACKOFF_JITTER_RATIO * 2

  return Math.round(base * factor)
}

export function hasExhaustedRetries(attempts: number): boolean {
  return attempts >= MAX_AUTO_ATTEMPTS
}

export function terminalRetryMessage(
  cause: string | null,
  noun: 'report' | 'access tag' = 'report',
): string {
  const reason = cause?.trim() ?? ''
  const prefix =
    reason === '' ? '' : `${reason.replace(/\.$/, '')}. `

  return `${prefix}Stopped retrying automatically after ${MAX_AUTO_ATTEMPTS} attempts. Retry when you are ready, or discard this ${noun}.`
}

// A manual retry or a fresh sign-in starts a new automatic budget; without
// the reset the first failure would land at the ceiling again (D-109).
export function restartQueueItemPatch(): QueueItemPatch {
  return {
    status: 'queued',
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
  }
}

// The server's clock is the only external reference on the path, so the
// correction is measured from its Date header and the instant is clamped
// to it: a queued report keeps its observation time, and never gains a
// future one (D-107).
export function correctedObservationTime(
  observedAt: string,
  skewMs: number,
  serverNow: number,
): string {
  const observed = Date.parse(observedAt)

  if (Number.isNaN(observed)) {
    return observedAt
  }

  return new Date(Math.min(observed - skewMs, serverNow)).toISOString()
}

function clockRepairMessage(skewMs: number): string {
  const minutes = Math.max(1, Math.round(Math.abs(skewMs) / 60_000))

  return `Device clock is ${minutes} min ahead of the server; retrying with the corrected observation time.`
}

export function isNetworkFailure(err: unknown): boolean {
  if (err instanceof NetworkTimeoutError) {
    return true
  }

  return !(err instanceof AuthApiError)
}

async function sendItem(
  token: string,
  item: QueueItem,
): Promise<{ id: number }> {
  if (item.kind === 'impact') {
    return reportApi.submitImpactReport(token, item.payload, item.id)
  }

  if (item.kind === 'tag') {
    return tagApi.submitTag(token, item.payload)
  }

  const photo = new Blob([item.photo], { type: item.photoType })

  return reportApi.submitReport(
    token,
    item.payload as FloodReportInput,
    photo,
    item.id,
    item.photoName,
  )
}

export function createDefaultDeps(): SyncDeps {
  return {
    getToken: getStoredToken,
    getLastAuthenticatedAt: readLastAuthenticatedAt,
    now: Date.now,
    sleep: (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms)
      }),
    list: listQueue,
    update: updateQueueItem,
    remove: removeQueueItem,
    send: sendItem,
    sendIntervalMs: SEND_INTERVAL_MS,
  }
}

function outcome(
  item: QueueItem,
  status: QueueOutcome['status'],
  message: string,
  reportId: number | null = null,
): QueueOutcome {
  return {
    id: item.id,
    status,
    message,
    reportId,
    at: Date.now(),
  }
}

function itemNoun(item: QueueItem): 'report' | 'access tag' {
  return item.kind === 'tag' ? 'access tag' : 'report'
}

function sentMessage(item: QueueItem, id: number): string {
  return item.kind === 'tag'
    ? `Access tag #${id} recorded.`
    : `Report #${id} sent.`
}

async function shrinkPhoto(
  item: LevelQueueItem,
  deps: SyncDeps,
): Promise<boolean> {
  if (item.photoBytes <= LAST_RESORT_PHOTO_BYTES) {
    return false
  }

  const target =
    item.photoBytes > RESCUE_PHOTO_BYTES
      ? RESCUE_PHOTO_BYTES
      : LAST_RESORT_PHOTO_BYTES

  const blob = new Blob([item.photo], { type: item.photoType })
  const compress = deps.compressPhoto ?? compressPhoto
  const compressed = await compress(blob, { targetBytes: target })
  const buffer = await compressed.blob.arrayBuffer()

  await deps.update(item.id, {
    photo: buffer,
    photoBytes: buffer.byteLength,
    photoType: compressed.blob.type,
    status: 'queued',
    nextAttemptAt: null,
  })

  return true
}

export async function runSync(
  userId: number,
  deps: SyncDeps = createDefaultDeps(),
  options: SyncOptions = {},
): Promise<SyncSummary> {
  const summary: SyncSummary = {
    sent: 0,
    failed: 0,
    remaining: 0,
    authRequired: false,
    authStale: false,
    outcomes: [],
  }

  const token = deps.getToken()

  if (token === null) {
    summary.remaining = (await deps.list(userId)).length
    return summary
  }

  if (isSyncWindowExpired(deps.now(), deps.getLastAuthenticatedAt())) {
    summary.authStale = true
    summary.remaining = (await deps.list(userId)).length
    return summary
  }

  let lastSentAt: number | null = null
  let stopped = false

  for (const item of await deps.list(userId)) {
    if (stopped) {
      break
    }

    if (item.status === 'failed' && !options.force) {
      continue
    }

    if (item.status === 'auth-required' && !options.force) {
      continue
    }

    if (
      item.nextAttemptAt !== null &&
      item.nextAttemptAt > deps.now()
    ) {
      continue
    }

    if (lastSentAt !== null && deps.sendIntervalMs > 0) {
      const wait = deps.sendIntervalMs - (deps.now() - lastSentAt)

      if (wait > 0) {
        await deps.sleep(wait)
      }
    }

    await deps.update(item.id, { status: 'syncing' })

    const sentAt = deps.now()

    try {
      const record = await deps.send(token, item)

      await deps.remove(item.id)
      summary.sent += 1
      summary.outcomes.push(
        outcome(item, 'sent', sentMessage(item, record.id), record.id),
      )
      lastSentAt = deps.now()
      continue
    } catch (err) {
      if (!(err instanceof AuthApiError)) {
        await scheduleRetry(item, err, deps, summary)
        continue
      }

      if (err.status === 401) {
        const message = `Sign in again to send this ${itemNoun(item)}.`

        await deps.update(item.id, {
          status: 'auth-required',
          lastError: message,
        })
        summary.authRequired = true
        summary.outcomes.push(outcome(item, 'auth-required', message))
        stopped = true
        continue
      }

      if (err.status === 403) {
        if (hasExhaustedRetries(item.attempts + 1)) {
          await stopRetrying(item, err.message, deps, summary)
          continue
        }

        await deps.update(item.id, {
          status: 'blocked',
          attempts: item.attempts + 1,
          nextAttemptAt: deps.now() + BLOCKED_RETRY_MS,
          lastError: err.message,
        })
        summary.outcomes.push(outcome(item, 'blocked', err.message))
        continue
      }

      // A proxy answers an oversized request with 413; the server names its own
      // size rejection on `photo_size`, so the same rescue covers both (D-108).
      // Only a level item carries a photograph to shrink.
      if (
        item.kind === 'level' &&
        (err.status === 413 ||
          (err.status === 422 && err.errors.photo_size !== undefined))
      ) {
        const shrunk = await shrinkPhoto(item, deps).catch(() => false)

        if (shrunk) {
          summary.outcomes.push(
            outcome(item, 'queued', 'Photo reduced and queued for retry.'),
          )
          continue
        }

        const message =
          'The photo is too large to send and cannot be reduced further. Take a new photo.'

        await deps.update(item.id, {
          status: 'failed',
          attempts: item.attempts + 1,
          nextAttemptAt: null,
          lastError: message,
        })
        summary.failed += 1
        summary.outcomes.push(outcome(item, 'failed', message))
        continue
      }

      if (err.status === 422) {
        // Each kind names its own capture instant: a report sends `reported_at`
        // and a tag sends `observed_at`; the repair itself is shared (D-107).
        const clockField = item.kind === 'tag' ? 'observed_at' : 'reported_at'
        const sentInstant =
          item.kind === 'tag'
            ? item.payload.observed_at
            : item.payload.reported_at
        const clockRejected =
          err.errors[clockField] !== undefined && sentInstant !== null

        if (clockRejected) {
          const alreadyRepaired =
            item.clockSkewMs !== undefined && item.clockSkewMs !== null

          if (!alreadyRepaired && err.serverDate !== null) {
            const skewMs = sentAt - err.serverDate
            const message = clockRepairMessage(skewMs)
            const corrected = correctedObservationTime(
              item.observedAt,
              skewMs,
              err.serverDate,
            )
            const repairedPayload =
              item.kind === 'tag'
                ? { ...item.payload, observed_at: corrected }
                : { ...item.payload, reported_at: corrected }

            await deps.update(item.id, {
              payload: repairedPayload,
              clockSkewMs: skewMs,
              status: 'queued',
              nextAttemptAt: null,
              lastError: message,
            })
            summary.outcomes.push(outcome(item, 'queued', message))
            continue
          }

          const message = alreadyRepaired
            ? 'The corrected observation time was rejected again. Check the device clock, then retry.'
            : 'The server did not report its time, so the device clock cannot be corrected. Check the device clock, then retry.'

          await deps.update(item.id, {
            status: 'failed',
            attempts: item.attempts + 1,
            nextAttemptAt: null,
            lastError: message,
          })
          summary.failed += 1
          summary.outcomes.push(outcome(item, 'failed', message))
          continue
        }

        await deps.update(item.id, {
          status: 'failed',
          attempts: item.attempts + 1,
          nextAttemptAt: null,
          lastError: err.message,
        })
        summary.failed += 1
        summary.outcomes.push(outcome(item, 'failed', err.message))
        continue
      }

      if (err.status === 429) {
        if (hasExhaustedRetries(item.attempts + 1)) {
          await stopRetrying(item, err.message, deps, summary)
          continue
        }

        const wait = (err.retryAfter ?? 60) * 1000

        await deps.update(item.id, {
          status: 'queued',
          attempts: item.attempts + 1,
          nextAttemptAt: deps.now() + wait,
          lastError: err.message,
        })
        summary.outcomes.push(
          outcome(
            item,
            'queued',
            `Rate limited. Retrying in ${Math.round(wait / 1000)}s.`,
          ),
        )
        stopped = true
        continue
      }

      if (err.status >= 500) {
        await scheduleRetry(item, err, deps, summary)
        continue
      }

      await deps.update(item.id, {
        status: 'failed',
        attempts: item.attempts + 1,
        nextAttemptAt: null,
        lastError: err.message,
      })
      summary.failed += 1
      summary.outcomes.push(outcome(item, 'failed', err.message))
    }
  }

  summary.remaining = (await deps.list(userId)).length

  return summary
}

async function scheduleRetry(
  item: QueueItem,
  err: unknown,
  deps: SyncDeps,
  summary: SyncSummary,
): Promise<void> {
  const attempts = item.attempts + 1
  const message = err instanceof Error ? err.message : 'Network unavailable.'

  if (hasExhaustedRetries(attempts)) {
    await stopRetrying(item, message, deps, summary)
    return
  }

  await deps.update(item.id, {
    status: 'queued',
    attempts,
    nextAttemptAt: deps.now() + backoffDelay(attempts, deps.random),
    lastError: message,
  })

  summary.outcomes.push(
    outcome(item, 'queued', `${message} Will retry automatically.`),
  )
}

async function stopRetrying(
  item: QueueItem,
  cause: string | null,
  deps: SyncDeps,
  summary: SyncSummary,
): Promise<void> {
  const message = terminalRetryMessage(cause, itemNoun(item))

  await deps.update(item.id, {
    status: 'failed',
    attempts: item.attempts + 1,
    nextAttemptAt: null,
    lastError: message,
  })

  summary.failed += 1
  summary.outcomes.push(outcome(item, 'failed', message))
}

const emptySummary = (): SyncSummary => ({
  sent: 0,
  failed: 0,
  remaining: 0,
  authRequired: false,
  authStale: false,
  outcomes: [],
})

let inFlight: Promise<SyncSummary> | null = null
let engineStop: (() => void) | null = null

export interface SyncState {
  running: boolean
  online: boolean
  authRequired: boolean
  authStale: boolean
  outcomes: QueueOutcome[]
  lastRunAt: number | null
}

let syncState: SyncState = {
  running: false,
  online:
    typeof navigator === 'undefined' ? true : navigator.onLine,
  authRequired: false,
  authStale: false,
  outcomes: [],
  lastRunAt: null,
}

const syncListeners = new Set<(state: SyncState) => void>()

function publish(patch: Partial<SyncState>): void {
  syncState = { ...syncState, ...patch }

  for (const listener of syncListeners) {
    listener(syncState)
  }
}

export function getSyncState(): SyncState {
  return syncState
}

export function subscribeToSync(
  listener: (state: SyncState) => void,
): () => void {
  syncListeners.add(listener)
  listener(syncState)

  return () => {
    syncListeners.delete(listener)
  }
}

export function clearSyncOutcomes(): void {
  publish({ outcomes: [] })
}

export function syncQueue(
  userId: number,
  options: SyncOptions = {},
): Promise<SyncSummary> {
  if (!currentOnline()) {
    publish({ online: false })

    return Promise.resolve(emptySummary())
  }

  if (inFlight !== null) {
    if (options.force) {
      return inFlight.then(() => syncQueue(userId, options))
    }

    return inFlight
  }

  publish({ running: true, online: currentOnline() })

  inFlight = runSync(userId, createDefaultDeps(), options)
    .then((summary) => {
      publish({
        running: false,
        outcomes: summary.outcomes,
        authRequired: summary.authRequired,
        authStale: summary.authStale,
        lastRunAt: Date.now(),
      })

      return summary
    })
    .catch(() => {
      publish({ running: false, lastRunAt: Date.now() })

      return emptySummary()
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}

function currentOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function startSyncEngine(userId: number): () => void {
  engineStop?.()

  const run = () => {
    if (!currentOnline()) {
      publish({ online: false })

      return
    }

    publish({ online: true })
    void syncQueue(userId)
  }

  const handleOnline = () => {
    publish({ online: true })
    run()
  }

  const handleOffline = () => publish({ online: false })

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      run()
    }
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  document.addEventListener('visibilitychange', handleVisibility)

  const timer = window.setInterval(run, 60_000)
  run()

  const stop = () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    document.removeEventListener('visibilitychange', handleVisibility)
    window.clearInterval(timer)

    if (engineStop === stop) {
      engineStop = null
    }
  }

  engineStop = stop

  return stop
}
