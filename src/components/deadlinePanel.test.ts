import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('consolidation deadline panel', () => {
  it('reads the server window and counts down from the server instant', () => {
    const bar = read('./DeadlineBar.tsx')

    expect(bar).toContain('fetchDeadlines')
    expect(bar).toContain(
      'remainingSeconds(\n    payload.window.next_cutoff_at,\n    payload.now,\n    elapsed,\n  )',
    )
    expect(bar).toContain('as of {describeAsOf(snapshot.fetchedAt)}')
    expect(bar).toContain('payload.window.label')
  })

  it('shows an indeterminate state instead of zero when offline without a cache', () => {
    const bar = read('./DeadlineBar.tsx')

    expect(bar).toContain('Pending counts are')
    expect(bar).toContain('unknown, not zero.')
    expect(bar).toContain('last known value while offline')
    expect(bar).toContain('readCachedDeadlines()')
  })

  it('labels the pending basis so the count is not mistaken for a receipt count', () => {
    const bar = read('./DeadlineBar.tsx')

    expect(bar).toContain('describeBasis(payload.pending.basis)')
  })

  it('shows the panel to reviewers only, above the filter bar', () => {
    const list = read('./ReportList.tsx')

    expect(list).toContain('{permissions.reviewReports && <DeadlineBar />}')
    expect(
      list.indexOf('{permissions.reviewReports && <DeadlineBar />}'),
    ).toBeLessThan(list.indexOf('<div className="filter-bar">'))
  })

  it('offers the alert-level filter the queue endpoint accepts', () => {
    const list = read('./ReportList.tsx')

    expect(list).toContain('id="filter-alert"')
    expect(list).toContain('updateFilter(\'alert_level\'')
    expect(list).toContain('ALERT_LEVEL_ORDER.map((level) => (')
    expect(list).toContain('alertTierLabel(level)')
  })
})
