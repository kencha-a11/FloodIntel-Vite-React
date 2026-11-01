import { useEffect, useState } from 'react'
import { Alert, Badge, Button, EmptyState, Spinner } from './ui'
import type { AlertTone } from './ui'
import { useAuth } from '../context/useAuth'
import { useQueue } from '../context/useQueue'
import { LEGACY_DEPTH_LABEL, alertTierLabel, floodLevelLabel } from '../lib/vocabulary'
import { formatDuration } from '../lib/format'
import { formatInstantWithAge } from '../lib/dateTime'
import type { QueueItem, QueueItemStatus, QueueOutcome } from '../types/queue'

// Design §7: a submission is "Queued — not yet received" until the API
// confirms it. "Sent" is only correct after that confirmation.
const STATUS_LABELS: Record<QueueItemStatus, string> = {
  queued: 'Queued — not yet received',
  syncing: 'Sending…',
  failed: 'Failed — not sent',
  blocked: 'Blocked — not sent',
  'auth-required': 'Sign-in needed',
}

const STATUS_TONES: Record<QueueItemStatus, 'neutral' | 'info' | 'danger' | 'warning'> = {
  queued: 'neutral',
  syncing: 'info',
  failed: 'danger',
  blocked: 'danger',
  'auth-required': 'warning',
}

function itemLabel(item: QueueItem): string {
  if (item.kind === 'impact') {
    return 'Impact report'
  }

  if (item.kind === 'tag') {
    return 'Access tag'
  }

  if (item.payload.alert_level !== null && item.payload.alert_level !== undefined) {
    return alertTierLabel(item.payload.alert_level)
  }

  const depth = floodLevelLabel(item.payload.flood_level)

  return depth === null ? LEGACY_DEPTH_LABEL : `${LEGACY_DEPTH_LABEL}: ${depth}`
}

function itemNoun(item: QueueItem): string {
  return item.kind === 'tag' ? 'tag' : 'report'
}

function discardConsequence(item: QueueItem): string {
  return item.kind === 'level'
    ? 'Its photo and saved details are deleted from this device.'
    : 'Its saved details are deleted from this device.'
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatAge(createdAt: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000))

  return `saved ${formatDuration(seconds)} ago`
}

// The capture instant is what a clock repair must not rewrite, so the row
// carries it under the D-06 label beside the save time (D-107).
function observedInstant(observedAt: string): string {
  if (Number.isNaN(Date.parse(observedAt))) {
    return 'Not recorded'
  }

  return formatInstantWithAge(observedAt)
}

function noticeTone(outcome: QueueOutcome): AlertTone {
  if (outcome.status === 'sent') {
    return 'success'
  }

  if (outcome.status === 'failed') {
    return 'danger'
  }

  return 'info'
}

function savedItemCount(count: number): string {
  return count === 1 ? '1 saved item' : `${count} saved items`
}

function authBannerText(stale: boolean, pendingCount: number): string {
  const reason = stale
    ? 'Saved items need a fresh sign-in (12-hour limit).'
    : 'Your session ended.'

  return pendingCount > 0
    ? `${reason} Sign in again to send ${savedItemCount(pendingCount)}.`
    : `${reason} Sign in again to continue.`
}

function queueAnnouncement(pendingCount: number, failedCount: number): string {
  const pending =
    pendingCount === 0
      ? 'No saved items waiting to send.'
      : `${savedItemCount(pendingCount)} waiting to send.`
  const failed = failedCount === 0 ? '' : ` ${failedCount} not sent.`

  return `${pending}${failed}`
}

export function QueueIndicator() {
  const {
    items,
    loaded,
    pendingCount,
    online,
    running,
    authRequired,
    authStale,
    storageAvailable,
    outcomes,
    retry,
    retryAll,
    discard,
    clearDeviceData,
    dismissOutcomes,
  } = useQueue()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null)
  const notice = outcomes[outcomes.length - 1] ?? null
  const failedCount = items.filter((item) => item.status === 'failed').length

  useEffect(() => {
    if (notice === null) {
      return
    }

    const timer = setTimeout(() => {
      dismissOutcomes()
    }, 6000)

    return () => clearTimeout(timer)
  }, [notice, dismissOutcomes])

  return (
    <div className="queue-widget">
      <p className="visually-hidden" role="status" aria-live="polite">
        {queueAnnouncement(pendingCount, failedCount)}
      </p>

      {(authRequired || authStale) && (
        <Alert tone="warning" role="alert" className="queue-alert">
          {authBannerText(authStale, pendingCount)}{' '}
          <Button variant="quiet" onClick={logout}>
            Sign in again
          </Button>
        </Alert>
      )}

      {!storageAvailable && (
        <Alert tone="warning" role="alert" className="queue-alert">
          Offline storage is unavailable in this browser. Reports will only
          send while the app stays open.
        </Alert>
      )}

      {notice !== null && (
        <Alert tone={noticeTone(notice)} role="status" className="queue-alert">
          {notice.message}{' '}
          <Button variant="quiet" onClick={dismissOutcomes}>
            Dismiss
          </Button>
        </Alert>
      )}

      <Button
        variant="secondary"
        size="compact"
        className="queue-button"
        aria-expanded={open}
        aria-controls="queue-panel"
        onClick={() => setOpen((current) => !current)}
      >
        {pendingCount > 0 ? `Queue (${pendingCount})` : 'Queue'}
        {failedCount > 0 && <Badge tone="danger">{failedCount} failed</Badge>}
        {!online && <Badge tone="warning">offline</Badge>}
      </Button>

      {running && <span className="muted queue-running">Syncing…</span>}

      {open && (
        <div
          className="queue-panel"
          id="queue-panel"
          aria-labelledby="queue-panel-title"
        >
          <h2 id="queue-panel-title">Offline queue</h2>

          {!loaded ? (
            <Spinner label="Checking saved items…" />
          ) : items.length === 0 ? (
            <EmptyState
              title="No saved items."
              description="A report or access tag captured without a connection stays here until the centre receives it."
            />
          ) : (
            <>
              {!online && (
                <Alert tone="warning" className="queue-alert">
                  You are offline. Saved items will send when the connection
                  returns.
                </Alert>
              )}

              <ul className="queue-items">
                {items.map((item) => (
                  <li key={item.id} className="queue-item">
                    <div className="queue-item-head">
                      <strong>{itemLabel(item)}</strong>
                      <Badge tone={STATUS_TONES[item.status]}>
                        {STATUS_LABELS[item.status]}
                      </Badge>
                    </div>

                    <p className="queue-item-times">
                      <span className="queue-instant-label">
                        Observed at (device)
                      </span>{' '}
                      <time dateTime={item.observedAt}>
                        {observedInstant(item.observedAt)}
                      </time>
                      <span className="muted">
                        {' '}
                        · {formatAge(item.createdAt)}
                        {item.kind === 'level' &&
                          ` · ${formatSize(item.photoBytes)}`}
                      </span>
                    </p>

                    <div className="queue-item-meta">
                      {item.attempts > 0 && (
                        <span className="muted">
                          {item.attempts} attempt
                          {item.attempts === 1 ? '' : 's'}
                        </span>
                      )}
                      {item.status !== 'syncing' && (
                        <Button
                          variant="quiet"
                          onClick={() => void retry(item.id)}
                        >
                          Retry
                        </Button>
                      )}
                      {item.status !== 'syncing' && confirmDiscard !== item.id && (
                        <Button
                          variant="quiet"
                          onClick={() => setConfirmDiscard(item.id)}
                        >
                          Discard
                        </Button>
                      )}
                    </div>

                    {item.lastError !== null && (
                      <Alert tone="danger">{item.lastError}</Alert>
                    )}

                    {confirmDiscard === item.id && (
                      <div className="queue-discard" role="group" aria-label="Confirm discard">
                        <p>
                          Discard {itemLabel(item)}? {discardConsequence(item)} This cannot be
                          undone.
                        </p>
                        <Button
                          variant="danger"
                          size="compact"
                          onClick={() => {
                            setConfirmDiscard(null)
                            void discard(item.id)
                          }}
                        >
                          Discard {itemNoun(item)}
                        </Button>
                        <Button
                          variant="quiet"
                          size="compact"
                          onClick={() => setConfirmDiscard(null)}
                        >
                          Keep {itemNoun(item)}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="queue-actions">
            <Button
              variant="secondary"
              size="compact"
              disabled={items.length === 0 || !online}
              onClick={() => void retryAll()}
            >
              Retry all
            </Button>

            {confirmClear ? (
              <>
                <Button
                  variant="danger"
                  size="compact"
                  onClick={() => {
                    void clearDeviceData()
                    setConfirmClear(false)
                  }}
                >
                  Delete {items.length} saved item
                  {items.length === 1 ? '' : 's'}
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="quiet"
                disabled={items.length === 0}
                onClick={() => setConfirmClear(true)}
              >
                Clear saved data
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
