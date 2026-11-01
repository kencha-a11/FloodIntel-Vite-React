import { useEffect, useState } from 'react'
import { Button, EmptyState } from './ui'
import { useAuth } from '../context/useAuth'
import { useQueue } from '../context/useQueue'
import { LEGACY_DEPTH_LABEL, alertTierLabel, floodLevelLabel } from '../lib/vocabulary'
import { formatDuration } from '../lib/format'
import type { QueueItem, QueueOutcome } from '../types/queue'

function levelLabel(item: QueueItem): string {
  if (item.kind === 'impact') {
    return 'Impact report'
  }

  if (item.payload.alert_level !== null && item.payload.alert_level !== undefined) {
    return alertTierLabel(item.payload.alert_level)
  }

  const depth = floodLevelLabel(item.payload.flood_level)

  return depth === null ? LEGACY_DEPTH_LABEL : `${LEGACY_DEPTH_LABEL}: ${depth}`
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

function statusLabel(item: QueueItem): string {
  switch (item.status) {
    case 'queued':
      return 'Waiting'
    case 'syncing':
      return 'Sending'
    case 'failed':
      return 'Failed'
    case 'blocked':
      return 'Blocked'
    case 'auth-required':
      return 'Sign-in needed'
  }
}

function noticeClass(outcome: QueueOutcome): string {
  if (outcome.status === 'sent' || outcome.status === 'merged') {
    return 'queue-notice is-success'
  }

  if (outcome.status === 'failed') {
    return 'queue-notice is-danger'
  }

  return 'queue-notice'
}

export function QueueIndicator() {
  const {
    items,
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
      {(authRequired || authStale) && (
        <p className="queue-banner" role="alert">
          {authStale
            ? 'Saved reports need a fresh sign-in (12-hour limit).'
            : 'Your session ended. Sign in again to send saved reports.'}{' '}
          <Button variant="quiet" onClick={logout}>
            Sign in again
          </Button>
        </p>
      )}

      {!storageAvailable && (
        <p className="queue-banner" role="alert">
          Offline storage is unavailable in this browser. Reports will only
          send while the app stays open.
        </p>
      )}

      {notice !== null && (
        <p className={noticeClass(notice)} role="status">
          {notice.message}{' '}
          <Button variant="quiet" onClick={dismissOutcomes}>
            Dismiss
          </Button>
        </p>
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
        {failedCount > 0 && (
          <span className="queue-failed">
            {failedCount} failed
          </span>
        )}
        {!online && <span className="queue-offline">offline</span>}
      </Button>

      {running && <span className="muted queue-running">Syncing…</span>}

      {open && (
        <div className="queue-panel" id="queue-panel">
          <h2>Offline queue</h2>

          {items.length === 0 ? (
            <EmptyState title="No saved reports." />
          ) : (
            <ul className="queue-items">
              {items.map((item) => (
                <li key={item.id} className="queue-item">
                  <div>
                    <strong>{levelLabel(item)}</strong>
                    <span className="muted">
                      {' '}
                      · {formatAge(item.createdAt)} ·{' '}
                      {formatSize(item.photoBytes)}
                    </span>
                  </div>

                  <div className="queue-item-meta">
                    <span className={`queue-status is-${item.status}`}>
                      {statusLabel(item)}
                    </span>
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
                    <small className="field-error">{item.lastError}</small>
                  )}

                  {confirmDiscard === item.id && (
                    <div className="queue-discard" role="group" aria-label="Confirm discard">
                      <p>
                        Discard {levelLabel(item)}? Its photo and saved details
                        are deleted from this device. This cannot be undone.
                      </p>
                      <Button
                        variant="danger"
                        size="compact"
                        onClick={() => {
                          setConfirmDiscard(null)
                          void discard(item.id)
                        }}
                      >
                        Discard report
                      </Button>
                      <Button
                        variant="quiet"
                        size="compact"
                        onClick={() => setConfirmDiscard(null)}
                      >
                        Keep report
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
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
                  Delete {items.length} saved report
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
