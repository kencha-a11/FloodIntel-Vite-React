import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ValidatedFeedMeta, ValidatedFeedRow } from '../types/report'
import { MapReportList } from './MapReportList'

/*
 * FR-59 / NFR-22: the list is the map's text alternative, so the markup is
 * checked for the same values a marker popup shows — barangay, tier number and
 * label, depth, both instants, source, and status — before it is ever opened.
 */

function row(overrides: Partial<ValidatedFeedRow> = {}): ValidatedFeedRow {
  return {
    id: 12,
    latitude: 14.95,
    longitude: 120.8,
    gps_accuracy: 5,
    barangay: { id: 4, name: 'Sampaloc' },
    alert_level: 'get_ready',
    alert_severity: 2,
    depth_cm: 42,
    observed_at: '2026-11-01T07:32:00Z',
    received_at: '2026-11-01T07:40:00Z',
    status: 'validated',
    source: 'reported',
    ...overrides,
  } as ValidatedFeedRow
}

const meta: ValidatedFeedMeta = { limit: 500, count: 1, truncated: false }

function render(rows: ValidatedFeedRow[], feedMeta: ValidatedFeedMeta | null = meta): string {
  return renderToStaticMarkup(<MapReportList rows={rows} meta={feedMeta} />)
}

describe('map report list', () => {
  it('shows every value a row carries without opening it', () => {
    const html = render([row()])

    expect(html).toContain('Level 2 — Get Ready')
    expect(html).toContain('2 of 3')
    expect(html).toContain('Sampaloc')
    expect(html).toContain('42 cm')
    expect(html).toContain('Observed')
    expect(html).toContain('Received')
    expect(html).toContain('Reported')
    expect(html).toContain('Validated')
  })

  it('keeps observed and received as separate machine-readable instants', () => {
    const html = render([row()])

    expect(html).toMatch(/dateTime="2026-11-01T07:32:00Z"/i)
    expect(html).toMatch(/dateTime="2026-11-01T07:40:00Z"/i)
  })

  it('states a missing depth rather than showing a blank or a zero', () => {
    expect(render([row({ depth_cm: null })])).toContain('Not recorded')
  })

  it('labels the toggle and links it to the list body', () => {
    const html = render([row()])

    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('aria-controls="map-report-list-body"')
    expect(html).toContain('id="map-report-list-body"')
    expect(html).toContain('Hide report list')
  })

  it('announces the count and sort order in a live region', () => {
    const html = render([row()])

    expect(html).toContain('role="status"')
    expect(html).toContain('1 validated report listed')
    expect(html).toContain('Sorted by highest alert tier first')
  })

  it('restates the feed truncation cap inside the list', () => {
    const truncated: ValidatedFeedMeta = { limit: 500, count: 500, truncated: true }

    expect(render([row()], truncated)).toContain('first 500 validated reports')
  })

  it('offers an empty state when the feed holds no validated report', () => {
    const html = render([], { limit: 500, count: 0, truncated: false })

    expect(html).toContain('No validated reports are in view.')
  })
})

describe('map wiring', () => {
  function read(relativePath: string): string {
    return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  }

  it('renders the list from the rows the map already loaded', () => {
    const source = read('./MapView.tsx')

    expect(source).toContain("from './MapReportList'")
    expect(source).toContain('<MapReportList rows={rows} meta={feedMeta} />')
    expect(source).toContain("layerStatus === 'ready' && <MapReportList")
  })

  it('does not fetch the validated feed a second time for the list', () => {
    const source = read('./MapView.tsx')

    expect(source.match(/listValidatedFeed\(/g)).toHaveLength(1)
  })
})
