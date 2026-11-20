import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SitrepReportList, SitrepRunStrip } from './SitrepWorkspace'
import { SitrepSupplementForm } from './SitrepSupplementForm'
import type {
  SituationalReport,
  SitrepRunStatusRow,
  SitrepSupplement,
} from '../types/sitrep'

function run(overrides: Partial<SitrepRunStatusRow>): SitrepRunStatusRow {
  return {
    cutoff_at: '2026-11-02T04:00:00+08:00',
    cutoff_label: 'November 2, 2026 4:00 AM',
    state: 'prepared',
    reason: null,
    situational_report_id: 1,
    triggered_by: 'schedule',
    actor_name: 'Ana Reyes',
    recorded_at: '2026-11-02T04:01:00+08:00',
    ...overrides,
  }
}

function report(overrides: Partial<SituationalReport>): SituationalReport {
  return {
    id: 1,
    event_id: 1,
    window_starts_at: '2026-11-01T15:00:00+08:00',
    window_ends_at: '2026-11-02T04:00:00+08:00',
    cutoff_at: '2026-11-02T04:00:00+08:00',
    cutoff_label: 'November 2, 2026 4:00 AM',
    timezone: 'Asia/Manila',
    snapshot_at: '2026-11-02T04:01:00+08:00',
    revision: 1,
    predecessor_id: null,
    format_version: '2',
    generated_by_name: 'Ana Reyes',
    generated_by_role: 'mdrrmo_staff',
    status_counts: {},
    totals: {},
    latency: {},
    barangays: [],
    stage_two: { available: false, affected_families: null, affected_individuals: null },
    content: null,
    created_at: '2026-11-02T04:01:00+08:00',
    ...overrides,
  }
}

describe('SitrepRunStrip', () => {
  it('labels a missed cutoff and a failed attempt distinctly', () => {
    const html = renderToStaticMarkup(
      <SitrepRunStrip
        rows={[
          run({ state: 'not_run', situational_report_id: null }),
          run({ cutoff_at: '2026-11-02T15:00:00+08:00', state: 'failed', reason: 'No scheduler principal.' }),
        ]}
      />,
    )

    expect(html).toContain('Missed')
    expect(html).toContain('No attempt was recorded for this cutoff.')
    expect(html).toContain('Failed')
    expect(html).toContain('No scheduler principal.')
  })

  it('renders nothing when there are no cutoffs', () => {
    expect(renderToStaticMarkup(<SitrepRunStrip rows={[]} />)).toBe('')
  })
})

describe('SitrepReportList', () => {
  it('marks an issued revision and a draft differently', () => {
    const html = renderToStaticMarkup(
      <SitrepReportList
        reports={[
          report({ id: 1 }),
          report({
            id: 2,
            revision: 2,
            issuance: {
              report_number: 7,
              issued_by_name: 'Cesar Carlos',
              issued_by_role: 'mdrrmo_officer',
              office: {},
              issued_at: '2026-11-02T05:00:00+08:00',
            },
          }),
        ]}
        selectedId={1}
        onSelect={() => {}}
      />,
    )

    expect(html).toContain('Draft')
    expect(html).toContain('Issued #7')
    expect(html).toContain('Revision 2')
    expect(html).toContain('is-selected')
  })

  it('offers an empty state when nothing is prepared', () => {
    const html = renderToStaticMarkup(
      <SitrepReportList reports={[]} selectedId={null} onSelect={() => {}} />,
    )

    expect(html).toContain('No situational reports yet')
  })
})

describe('SitrepSupplementForm', () => {
  const barangays = [
    { id: 1, name: 'Balucuc' },
    { id: 2, name: 'San Juan' },
  ]

  it('lists every section and the aggregate-only source field', () => {
    const html = renderToStaticMarkup(
      <SitrepSupplementForm
        token="t"
        eventId={1}
        barangays={barangays}
        editing={null}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(html).toContain('Weather')
    expect(html).toContain('Casualties (aggregate)')
    expect(html).toContain('Actions taken')
    expect(html).toContain('Source')
    // Weather is municipality-wide: no barangay picker until a scoped section.
    expect(html).not.toContain('Choose a barangay')
  })

  it('requires a barangay for a scoped section being edited', () => {
    const editing: SitrepSupplement = {
      id: 5,
      event_id: 1,
      section: 'casualties',
      barangay_id: 1,
      barangay: 'Balucuc',
      payload: { dead: 2, injured: 5 },
      source: 'Barangay report',
      observed_at: null,
      created_by_name: 'Ana Reyes',
      created_at: '2026-11-02T04:00:00+08:00',
      updated_at: '2026-11-02T04:00:00+08:00',
    }

    const html = renderToStaticMarkup(
      <SitrepSupplementForm
        token="t"
        eventId={1}
        barangays={barangays}
        editing={editing}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(html).toContain('Choose a barangay')
    expect(html).toContain('Dead (persons)')
    expect(html).toContain('Injured (persons)')
    expect(html).toContain('Update draft')
  })
})