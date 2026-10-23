import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { useQueue } from '../context/useQueue'
import { FLOOD_LEVELS } from '../lib/floodLevels'
import { formatDuration } from '../lib/format'
import type { QueueItem, QueueOutcome } from '../types/queue'

function levelLabel(item: QueueItem): string {
  return (
    FLOOD_LEVELS.find(
      (level) => level.value === item.payload.flood_level,
    )?.label ?? item.payload.flood_level
  )
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
    clearDeviceData,
    dismissOutcomes,
  } = useQueue()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const notice = outcomes[outcomes.length - 1] ?? null

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
          <button type="button" className="link" onClick={logout}>
            Sign in again
          </button>
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
          <button
            type="button"
            className="link"
            onClick={dismissOutcomes}
          >
            Dismiss
          </button>
        </p>
      )}

      <button
        type="button"
        className="counter queue-button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {pendingCount > 0 ? `Queue (${pendingCount})` : 'Queue'}
        {!online && <span className="queue-offline">offline</span>}
      </button>

      {running && <span className="muted queue-running">Syncing…</span>}

      {open && (
        <div className="queue-panel">
          <h3>Offline queue</h3>

          {items.length === 0 ? (
            <p className="muted">No saved reports.</p>
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
                      <button
                        type="button"
                        className="link"
                        onClick={() => void retry(item.id)}
                      >
                        Retry
                      </button>
                    )}
                  </div>

                  {item.lastError !== null && (
                    <small className="field-error">{item.lastError}</small>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="queue-actions">
            <button
              type="button"
              className="counter"
              disabled={items.length === 0 || !online}
              onClick={() => void retryAll()}
            >
              Retry all
            </button>

            {confirmClear ? (
              <>
                <button
                  type="button"
                  className="counter"
                  onClick={() => {
                    void clearDeviceData()
                    setConfirmClear(false)
                  }}
                >
                  Delete {items.length} saved report
                  {items.length === 1 ? '' : 's'}
                </button>
                <button
                  type="button"
                  className="link"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="link"
                disabled={items.length === 0}
                onClick={() => setConfirmClear(true)}
              >
                Clear saved data
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
