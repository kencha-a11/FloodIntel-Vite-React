import {
  API_BASE_URL,
  AuthApiError,
  NetworkTimeoutError,
  getStoredToken,
  request,
} from './http'
import { compressPhoto } from './photo'
import {
  LAST_RESORT_PHOTO_BYTES,
  RESCUE_PHOTO_BYTES,
} from './floodLevels'
import * as reportApi from './reportApi'
import {
  listQueue,
  removeQueueItem,
  updateQueueItem,
} from './offlineQueue'
import { isSyncWindowExpired, readLastAuthenticatedAt } from './session'
import type { FloodReport, Paginated } from '../types/report'
import type { QueueItem, QueueOutcome } from '../types/queue'

const BACKOFF_MS = [
  15_000,
  60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
]

const BLOCKED_RETRY_MS = 60 * 60_000

const SEND_INTERVAL_MS = 6_000

const REPLAY_TOLERANCE_MS = 10_000

export interface SyncSummary {
  sent: number
  merged: number
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
    patch: Partial<QueueItem>,
  ) => Promise<QueueItem | null>
  remove: (id: string) => Promise<void>
  send: (token: string, item: QueueItem) => Promise<FloodReport>
  findDuplicate: (
    token: string,
    item: QueueItem,
  ) => Promise<FloodReport | null>
  sendIntervalMs: number
}

export interface SyncOptions {
  force?: boolean
}

export function backoffDelay(attempts: number): number {
  const index = Math.min(Math.max(attempts, 1), BACKOFF_MS.length) - 1

  return BACKOFF_MS[index]
}

export function isReplayMatch(
  report: FloodReport,
  item: QueueItem,
): boolean {
  if (report.user.id !== item.userId) {
    return false
  }

  if (report.flood_level !== item.payload.flood_level) {
    return false
  }

  if (
    Math.abs(report.latitude - item.payload.latitude) > 0.000001 ||
    Math.abs(report.longitude - item.payload.longitude) > 0.000001
  ) {
    return false
  }

  const observed = item.payload.reported_at ?? item.observedAt
  const candidate = report.reported_at ?? report.created_at

  return (
    Math.abs(Date.parse(candidate) - Date.parse(observed)) <=
    REPLAY_TOLERANCE_MS
  )
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
): Promise<FloodReport> {
  const photo = new Blob([item.photo], { type: item.photoType })

  return reportApi.submitReport(
    token,
    item.payload,
    photo,
    item.id,
    item.photoName,
  )
}

async function findDuplicateReport(
  token: string,
  item: QueueItem,
): Promise<FloodReport | null> {
  const from = new Date(
    Date.parse(item.observedAt) - 60_000,
  ).toISOString()
  const query = new URLSearchParams({
    from,
    per_page: '50',
  })

  const response = await request<Paginated<FloodReport>>(
    `${API_BASE_URL}/flood-reports?${query.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )

  return (
    response.data.find((report) => isReplayMatch(report, item)) ?? null
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
    findDuplicate: findDuplicateReport,
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

async function shrinkPhoto(
  item: QueueItem,
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
  const compressed = await compressPhoto(blob, { targetBytes: target })
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
    merged: 0,
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

    if (item.status === 'syncing') {
      const duplicate = await safeFindDuplicate(deps, token, item)

      if (duplicate !== null) {
        await deps.remove(item.id)
        summary.merged += 1
        summary.outcomes.push(
          outcome(
            item,
            'merged',
            `Report #${duplicate.id} was already received.`,
            duplicate.id,
          ),
        )
        continue
      }
    }

    await deps.update(item.id, { status: 'syncing' })

    try {
      const report = await deps.send(token, item)

      await deps.remove(item.id)
      summary.sent += 1
      summary.outcomes.push(
        outcome(item, 'sent', `Report #${report.id} sent.`, report.id),
      )
      lastSentAt = deps.now()
      continue
    } catch (err) {
      if (!(err instanceof AuthApiError)) {
        const duplicate = await safeFindDuplicate(deps, token, item)

        if (duplicate !== null) {
          await deps.remove(item.id)
          summary.merged += 1
          summary.outcomes.push(
            outcome(
              item,
              'merged',
              `Report #${duplicate.id} was already received.`,
              duplicate.id,
            ),
          )
          continue
        }

        await scheduleRetry(item, err, deps, summary)
        continue
      }

      if (err.status === 401) {
        await deps.update(item.id, {
          status: 'auth-required',
          lastError: 'Sign in again to send this report.',
        })
        summary.authRequired = true
        summary.outcomes.push(
          outcome(item, 'auth-required', 'Sign in again to send this report.'),
        )
        stopped = true
        continue
      }

      if (err.status === 403) {
        await deps.update(item.id, {
          status: 'blocked',
          attempts: item.attempts + 1,
          nextAttemptAt: deps.now() + BLOCKED_RETRY_MS,
          lastError: err.message,
        })
        summary.outcomes.push(outcome(item, 'blocked', err.message))
        continue
      }

      if (err.status === 413) {
        const shrunk = await shrinkPhoto(item, deps).catch(() => false)

        if (shrunk) {
          summary.outcomes.push(
            outcome(item, 'queued', 'Photo reduced and queued for retry.'),
          )
          continue
        }
      }

      if (err.status === 422) {
        if (
          err.errors.reported_at !== undefined &&
          item.payload.reported_at !== null
        ) {
          await deps.update(item.id, {
            payload: { ...item.payload, reported_at: null },
            status: 'queued',
            nextAttemptAt: null,
            lastError: 'Device clock adjusted; retrying with server time.',
          })
          summary.outcomes.push(
            outcome(
              item,
              'queued',
              'Retrying with the server timestamp because the device clock is ahead.',
            ),
          )
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
        const duplicate = await safeFindDuplicate(deps, token, item)

        if (duplicate !== null) {
          await deps.remove(item.id)
          summary.merged += 1
          summary.outcomes.push(
            outcome(
              item,
              'merged',
              `Report #${duplicate.id} was already received.`,
              duplicate.id,
            ),
          )
          continue
        }

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

async function safeFindDuplicate(
  deps: SyncDeps,
  token: string,
  item: QueueItem,
): Promise<FloodReport | null> {
  try {
    return await deps.findDuplicate(token, item)
  } catch {
    return null
  }
}

async function scheduleRetry(
  item: QueueItem,
  err: unknown,
  deps: SyncDeps,
  summary: SyncSummary,
): Promise<void> {
  const attempts = item.attempts + 1
  const message = err instanceof Error ? err.message : 'Network unavailable.'

  await deps.update(item.id, {
    status: 'queued',
    attempts,
    nextAttemptAt: deps.now() + backoffDelay(attempts),
    lastError: message,
  })

  summary.outcomes.push(
    outcome(item, 'queued', `${message} Will retry automatically.`),
  )
}

const emptySummary = (): SyncSummary => ({
  sent: 0,
  merged: 0,
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
