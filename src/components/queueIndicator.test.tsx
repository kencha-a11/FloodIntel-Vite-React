import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AuthContext, type AuthContextValue } from '../context/AuthContext'
import { QueueContext, type QueueContextValue } from '../context/QueueContext'
import type { User } from '../types/auth'
import type { LevelQueueItem, QueueOutcome, TagQueueItem } from '../types/queue'
import { QueueIndicator } from './QueueIndicator'

/*
 * Design §7: a queued submission is never called sent before the API confirms
 * it, and the engine's states must be readable without relying on colour.
 * §14: the queue indicator carries the count, the per-item state, retry,
 * retry-all, clear, and the auth explanation.
 */

const reporter: User = {
  id: 4,
  first_name: 'Ana',
  last_name: 'Reyes',
  full_name: 'Ana Reyes',
  contact_number: '09170000000',
  email: 'ana@example.test',
  email_verified_at: '2026-11-01T00:00:00Z',
  created_at: '2026-11-01T00:00:00Z',
  role: 'barangay_tanod',
  role_label: 'Barangay Tanod',
  interface: 'field_reporter',
  abilities: ['submit-report'],
  barangay: { id: 1, name: 'San Juan', code: 'SANJUAN', is_active: true },
}

const auth: AuthContextValue = {
  user: reporter,
  isLoading: false,
  isEmailVerified: true,
  lockoutSeconds: 0,
  error: null,
  fieldErrors: {},
  login: async () => false,
  logout: async () => {},
  refreshUser: async () => {},
  resendVerification: async () => ({ status: 'sent', message: 'Sent.' }),
  clearError: () => {},
}

function levelItem(overrides: Partial<LevelQueueItem> = {}): LevelQueueItem {
  return {
    id: 'local-1',
    kind: 'level',
    userId: reporter.id,
    photo: new ArrayBuffer(0),
    photoType: 'image/jpeg',
    photoName: 'street.jpg',
    photoBytes: 204800,
    status: 'queued',
    attempts: 0,
    lastError: null,
    nextAttemptAt: null,
    createdAt: Date.now() - 120000,
    observedAt: '2026-11-01T02:00:00Z',
    payload: {
      flood_level: 'knee',
      alert_level: null,
      flood_type: null,
      depth_cm: 45,
      landmark: 'Bayanihan Road',
      latitude: 14.95,
      longitude: 120.76,
      gps_accuracy: 8,
      notes: null,
      reported_at: '2026-11-01T02:00:00Z',
      supersedes_id: null,
    },
    ...overrides,
  }
}

function tagItem(overrides: Partial<TagQueueItem> = {}): TagQueueItem {
  return {
    id: 'local-tag-1',
    kind: 'tag',
    userId: reporter.id,
    status: 'queued',
    attempts: 0,
    lastError: null,
    nextAttemptAt: null,
    createdAt: Date.now() - 60000,
    observedAt: '2026-11-01T02:00:00Z',
    payload: {
      type: 'narrow_alley',
      note: null,
      landmark: 'Sitio Balite footpath',
      latitude: 14.95,
      longitude: 120.76,
      gps_accuracy: 8,
      address: null,
      observed_at: '2026-11-01T02:00:00Z',
    },
    ...overrides,
  }
}

function queue(overrides: Partial<QueueContextValue> = {}): QueueContextValue {
  return {
    items: [],
    loaded: true,
    pendingCount: 0,
    online: true,
    running: false,
    authRequired: false,
    authStale: false,
    storageAvailable: true,
    outcomes: [],
    submitLevelReport: async () => ({
      id: '',
      queued: false,
      failed: false,
      reportId: null,
      message: '',
    }),
    submitImpactReport: async () => ({
      id: '',
      queued: false,
      failed: false,
      reportId: null,
      message: '',
    }),
    submitTag: async () => ({
      id: '',
      queued: false,
      failed: false,
      reportId: null,
      message: '',
    }),
    retry: async () => {},
    retryAll: async () => {},
    discard: async () => {},
    clearDeviceData: async () => {},
    dismissOutcomes: () => {},
    refresh: async () => {},
    ...overrides,
  }
}

function render(value: QueueContextValue): string {
  return renderToStaticMarkup(
    <AuthContext.Provider value={auth}>
      <QueueContext.Provider value={value}>
        <QueueIndicator />
      </QueueContext.Provider>
    </AuthContext.Provider>,
  )
}

function outcome(status: QueueOutcome['status'], message: string): QueueOutcome {
  return { id: `outcome-${status}`, status, message, reportId: null, at: Date.now() }
}

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('queue indicator announcements', () => {
  it('announces the waiting count and the failures on one polite region', () => {
    const html = render(
      queue({
        items: [
          levelItem(),
          levelItem({ id: 'local-2', status: 'failed', lastError: 'Photo too large.' }),
        ],
        pendingCount: 2,
      }),
    )

    expect(html).toContain('2 saved items waiting to send. 1 not sent.')
    expect(html).toMatch(/class="visually-hidden" role="status" aria-live="polite"/)
  })

  it('says nothing waits when the queue is empty', () => {
    expect(render(queue())).toContain('No saved items waiting to send.')
  })

  it('counts a saved access tag as an item', () => {
    const html = render(queue({ items: [tagItem()], pendingCount: 1 }))

    expect(html).toContain('1 saved item waiting to send.')
  })
})

describe('queue indicator trigger', () => {
  it('puts the pending count on the trigger and marks failures and loss of signal', () => {
    const html = render(
      queue({
        items: [levelItem(), levelItem({ id: 'local-2', status: 'failed' })],
        pendingCount: 2,
        online: false,
      }),
    )

    expect(html).toContain('Queue (2)')
    expect(html).toContain('1 failed')
    expect(html).toContain('ui-badge--danger')
    expect(html).toContain('ui-badge--warning')
    expect(html).toContain('offline')
  })

  it('drops the count when nothing waits but keeps the trigger', () => {
    const html = render(queue())

    expect(html).toContain('>Queue</button>')
    expect(html).not.toContain('Queue (')
  })
})

describe('queue indicator session banners', () => {
  it('names the reason and the items a fresh sign-in would send', () => {
    const html = render(queue({ authStale: true, pendingCount: 3 }))

    expect(html).toContain(
      'Saved items need a fresh sign-in (12-hour limit). Sign in again to send 3 saved items.',
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('Sign in again')
  })

  it('uses the singular for one saved item and asks to continue when none wait', () => {
    expect(render(queue({ authStale: true, pendingCount: 1 }))).toContain(
      'Sign in again to send 1 saved item.',
    )
    expect(render(queue({ authRequired: true, pendingCount: 0 }))).toContain(
      'Your session ended. Sign in again to continue.',
    )
  })

  it('explains a browser that cannot keep items between sessions', () => {
    const html = render(queue({ storageAvailable: false }))

    expect(html).toContain('Offline storage is unavailable in this browser.')
    expect(html).toContain('role="alert"')
  })
})

describe('queue indicator outcomes', () => {
  it('tones the last outcome by what actually happened', () => {
    const sent = render(queue({ outcomes: [outcome('sent', 'Report #12 sent.')] }))
    const failed = render(
      queue({ outcomes: [outcome('failed', 'Photo too large.'), outcome('failed', '413')] }),
    )

    expect(sent).toContain('Report #12 sent.')
    expect(sent).toContain('ui-alert--success')
    expect(failed).toContain('ui-alert--danger')
    expect(failed).toContain('413')
    expect(failed).not.toContain('Photo too large.')
  })
})

describe('queue panel states', () => {
  const indicator = read('./QueueIndicator.tsx')

  it('says queued, never sent, until the API confirms', () => {
    expect(indicator).toContain("queued: 'Queued — not yet received'")
    expect(indicator).toContain("failed: 'Failed — not sent'")
    expect(indicator).toContain("blocked: 'Blocked — not sent'")
    expect(indicator).not.toMatch(/'Received'|'Sent'|'Unsent'/)
  })

  it('carries the state in words, not only in the tone', () => {
    expect(indicator).toContain('STATUS_LABELS[item.status]')
    expect(indicator).toContain('<Badge tone={STATUS_TONES[item.status]}>')
  })

  it('waits for the first read before it claims the queue is empty', () => {
    expect(indicator).toContain('!loaded ? (')
    expect(indicator).toContain('<Spinner label="Checking saved items…" />')
    expect(indicator).toContain('A report or access tag captured without a connection stays here until the centre receives it.')
  })

  it('explains the wait while offline and offers no futile retry', () => {
    expect(indicator).toContain('You are offline. Saved items will send when the connection')
    expect(indicator).toContain('disabled={items.length === 0 || !online}')
  })

  it('names an access tag and prints no photo size for it', () => {
    expect(indicator).toContain("return 'Access tag'")
    expect(indicator).toContain("item.kind === 'level' &&")
    expect(indicator).toContain('` · ${formatSize(item.photoBytes)}`')
    expect(indicator).toContain("item.kind === 'tag' ? 'tag' : 'report'")
  })
})
