import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('impact reporting screens', () => {
  it('files through the offline queue instead of a direct request', () => {
    const form = read('./FloodImpactReportForm.tsx')

    expect(form).toContain('submitImpactReport')
    expect(form).toContain("from '../lib/impactDeviation'")
    expect(form).not.toContain('fetch(')
  })

  it('shows the deviation warning as advice, never as a blocking error', () => {
    const form = read('./FloodImpactReportForm.tsx')

    const validate = form.slice(
      form.indexOf('function validate()'),
      form.indexOf('function handleReview'),
    )

    expect(form).toContain('<Alert tone="warning">{warning}</Alert>')
    expect(validate).not.toContain('warning')
  })

  it('explains that no impact report can be filed before an event opens', () => {
    const form = read('./FloodImpactReportForm.tsx')

    expect(form).toContain(
      'The command center must open a flood event before barangays can file impact reports.',
    )
  })

  it('separates filing from reading the barangay status', () => {
    const app = read('../App.tsx')

    expect(app).toContain(`const ABILITY_SUBMIT_IMPACT_REPORT = 'submit-impact-report'`)
    expect(app).toContain(
      `canFileImpact || abilities.includes(ABILITY_VIEW_OWN_BARANGAY)`,
    )
    expect(app).toContain('<ImpactReportsView canFileImpact={canFileImpact} />')
  })

  it('refreshes the status list after a report is filed', () => {
    const view = read('./ImpactReportsView.tsx')

    expect(view).toContain(
      '<FloodImpactReportForm reports={reports} onFiled={refresh} />',
    )
    expect(view).toContain('reports={loaded ? reports : null}')
  })

  it('keeps the open-event list for offline filing', () => {
    const api = read('../lib/impactApi.ts')

    expect(api).toContain(`const EVENTS_CACHE_KEY = 'floodintel:impact-events'`)
    expect(api).toContain('cacheEvents(response.data)')
    expect(api).toContain('readCachedEvents()')
  })

  it('corrects a report by filing a superseding one', () => {
    const form = read('./FloodImpactReportForm.tsx')

    expect(form).toContain('Correct a previous report (optional)')
    expect(form).toContain('correctableReports(reports, eventId)')
    expect(form).toContain('supersedes_id: supersedesId')
    expect(form).toContain('Report #{corrected.id}')
  })

  it('labels the earlier report once a newer one supersedes it', () => {
    const view = read('./BarangayImpactStatusView.tsx')

    expect(view).toContain("superseded: 'Superseded'")
    expect(view).toContain('candidate.supersedes_id === report.id')
    expect(view).toContain('Superseded by #{superseder.id}')
  })
})
