import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AuthContext, type AuthContextValue } from '../context/AuthContext'
import type { User } from '../types/auth'
import { ReviewWorkspace } from './ReviewWorkspace'

/*
 * Design §10: the queue stays visible while a report is open at 1024 px and
 * above; below that the view is list → detail. §11: observed and received
 * instants are separate and both readable. These guards pin the split and the
 * markup the CSS chooses between.
 */

const reviewer: User = {
  id: 4,
  first_name: 'Ana',
  last_name: 'Reyes',
  full_name: 'Ana Reyes',
  contact_number: '09170000000',
  email: 'ana@example.test',
  email_verified_at: '2026-11-01T00:00:00Z',
  created_at: '2026-11-01T00:00:00Z',
  role: 'mdrrmo_officer',
  role_label: 'MDRRMO Officer',
  interface: 'command_center',
  abilities: ['view-all-barangays', 'validate-report'],
  barangay: null,
}

const context: AuthContextValue = {
  user: reviewer,
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

const store: Record<string, string> = {}

const localStorageStub = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value
  },
  removeItem: (key: string) => {
    delete store[key]
  },
  clear: () => {
    for (const key of Object.keys(store)) {
      delete store[key]
    }
  },
  key: () => null,
  get length() {
    return Object.keys(store).length
  },
} as unknown as Storage

const hadLocalStorage = 'localStorage' in globalThis
const previousLocalStorage = hadLocalStorage
  ? (globalThis as unknown as { localStorage: Storage }).localStorage
  : undefined

beforeAll(() => {
  // Node 24 ships a webstorage object that omits getItem, so the stub is
  // installed either way and the previous value restored afterwards.
  ;(globalThis as unknown as { localStorage: Storage }).localStorage =
    localStorageStub
})

afterAll(() => {
  if (previousLocalStorage === undefined) {
    delete (globalThis as { localStorage?: Storage }).localStorage
  } else {
    ;(globalThis as unknown as { localStorage: Storage }).localStorage =
      previousLocalStorage
  }
})

function render(selectedReportId: number | null): string {
  return renderToStaticMarkup(
    <AuthContext.Provider value={context}>
      <ReviewWorkspace
        canFilter
        selectedReportId={selectedReportId}
        onSelect={() => {}}
        onClear={() => {}}
        onCorrect={() => {}}
      />
    </AuthContext.Provider>,
  )
}

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('review workspace', () => {
  it('names both panes and prompts for a report before one is chosen', () => {
    const html = render(null)

    expect(html).toContain('aria-label="Review queue"')
    expect(html).toContain('aria-label="Selected report"')
    expect(html).toContain('No report selected.')
    expect(html).toContain('Choose a report from the queue')
    expect(html).not.toContain('Report #')
  })

  it('keeps the queue mounted and beside the report while one is open', () => {
    const html = render(7)

    expect(html).toContain('class="review-workspace has-selection"')
    expect(html).toContain('>Flood report queue</h2>')
    expect(html).toContain('>Report #7</h2>')
    expect(html).toContain('aria-label="Review queue"')
  })

  it('moves focus to the pane that now holds the reading position', () => {
    const source = read('./ReviewWorkspace.tsx')

    expect(source).toContain('detailRef.current?.focus')
    expect(source).toContain('queueRef.current?.focus')
    expect(source).toContain('previousSelection')
  })

  it('shows one pane below 1024 px and both above it', () => {
    const css = read('../App.css')
    const block = css.indexOf('.review-workspace {')
    const split = css.indexOf('@media (min-width: 1024px)', block)

    expect(block).toBeGreaterThan(-1)
    expect(split).toBeGreaterThan(block)
    expect(css).toContain(
      '.review-workspace.has-selection .review-workspace-queue',
    )
    expect(css).toContain(
      '.review-workspace:not(.has-selection) .review-workspace-detail',
    )
    expect(css.slice(block, split)).toContain('display: none')
    expect(css.slice(split)).toContain('display: block')
  })
})

describe('review queue rows', () => {
  it('marks the open row as the current item in the list', () => {
    const list = read('./ReportList.tsx')

    expect(list).toContain('report.id === selectedReportId')
    expect(list).toContain("aria-current={report.id === selectedReportId ? 'true' : undefined}")
    expect(list).toContain('report-row-selected')
  })

  it('shows observed and received as separate labeled instants', () => {
    const list = read('./ReportList.tsx')

    expect(list).toContain('<InstantRow label="Observed" value={report.reported_at} />')
    expect(list).toContain('<InstantRow label="Received" value={report.created_at} />')
    expect(list).toContain('<time dateTime={value}>')
    expect(list).toContain('NOT_RECORDED')
    expect(list).not.toContain('toLocaleString()')
  })
})

describe('correction chain', () => {
  it('shows the chain in both directions with the prior return reason', () => {
    const detail = read('./ReportDetail.tsx')

    expect(detail).toContain('aria-label="Correction chain"')
    expect(detail).toContain('correctionLinkLabel(priorReport.id)')
    expect(detail).toContain('supersededByLabel(successorId)')
    expect(detail).toContain('priorReport.returned_reason')
  })

  it('offers a new report on the returned head, never an edit', () => {
    const detail = read('./ReportDetail.tsx')

    expect(detail).toContain('canFileCorrection(report,')
    expect(detail).toContain('File a corrected report')
    expect(detail).not.toMatch(/Edit report|Update report/)
  })

  it('marks a correction in the queue row', () => {
    const list = read('./ReportList.tsx')

    expect(list).toContain('report.supersedes_id !== null')
    expect(list).toContain('correctionLinkLabel(report.supersedes_id)')
  })

  it('answers the return from the capture screen and clears the link after it', () => {
    const form = read('./FloodReportForm.tsx')

    expect(form).toContain('supersedes_id: correctsReportId')
    expect(form).toContain('Stop correcting')
    expect(form).toContain('onCorrectionCleared?.()')
  })
})

describe('review decision dialogs', () => {
  it('asks through the shared dialog instead of the browser prompt', () => {
    const detail = read('./ReportDetail.tsx')

    expect(detail).not.toContain('window.confirm')
    expect(detail).toContain('decisionCopy(decision)')
    expect(detail).toContain('DECISION_CANCEL_LABEL')
    expect(detail).toContain('<Dialog')
  })

  it('confirms all four decisions, rejection included', () => {
    const detail = read('./ReportDetail.tsx')

    expect(detail).toContain("kind: 'validate'")
    expect(detail).toContain("kind: 'return'")
    expect(detail).toContain("kind: 'reject'")
    expect(detail).toContain("kind: 'override'")
  })

  it('keeps observed and received apart in the report itself', () => {
    const detail = read('./ReportDetail.tsx')

    expect(detail).toContain('<dt>Observed at (device)</dt>')
    expect(detail).toContain('<dt>Received at (system)</dt>')
    expect(detail).toContain('<time dateTime={report.reported_at}>')
    expect(detail).toContain('<time dateTime={report.created_at}>')
    expect(detail).toContain('<time dateTime={change.created_at}>')
  })
})
