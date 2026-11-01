import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AccessTag } from '../types/accessTag'
import { AccessTagRows } from './AccessTagList'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

function tag(overrides: Partial<AccessTag> = {}): AccessTag {
  return {
    id: 1,
    barangay: { id: 2, name: 'San Juan' },
    recorded_by: {
      id: 9,
      first_name: 'Ana',
      last_name: 'Reyes',
      role: 'barangay_tanod',
    },
    type: 'no_vehicle_access',
    type_label: 'No vehicle access',
    landmark: 'Sitio Balite alley',
    note: null,
    latitude: 14.95,
    longitude: 120.83,
    gps_accuracy: 8,
    address: null,
    observed_at: '2026-11-02T10:00:00Z',
    is_active: true,
    retired_at: null,
    retired_reason: null,
    retired_by: null,
    created_at: '2026-11-02T10:05:00Z',
    ...overrides,
  }
}

function render(tags: AccessTag[]): string {
  return renderToStaticMarkup(<AccessTagRows tags={tags} />)
}

/*
 * A11Y-07 / D-132: the list is a read of the record, never an edit of it. It
 * shows the state and, for a retired tag, the instant, actor, and reason that
 * keep the retirement explainable (FR-121).
 */

describe('access tag rows', () => {
  it('shows the label, barangay, landmark, and observation instant', () => {
    const html = render([tag()])

    expect(html).toContain('No vehicle access')
    expect(html).toContain('San Juan')
    expect(html).toContain('Recorded by Ana Reyes')
    expect(html).toContain('Landmark: Sitio Balite alley')
    expect(html).toContain('Active')
    expect(html).toContain('<time dateTime="2026-11-02T10:00:00Z">')
  })

  it('never renders the raw taxonomy value in place of its label', () => {
    const html = render([tag()])

    expect(html).not.toContain('no_vehicle_access')
  })

  it('names a missing landmark rather than leaving a blank', () => {
    expect(render([tag({ landmark: null })])).toContain('Landmark: Not recorded')
  })

  it('keeps a retired tag readable with its instant, actor, and reason', () => {
    const html = render([
      tag({
        is_active: false,
        retired_at: '2026-11-02T12:30:00Z',
        retired_reason: 'Alley cleared',
        retired_by: {
          id: 3,
          first_name: 'Ben',
          last_name: 'Cruz',
          role: 'mdrrmo_officer',
        },
      }),
    ])

    expect(html).toContain('Retired')
    expect(html).toContain('<time dateTime="2026-11-02T12:30:00Z">')
    expect(html).toContain('by Ben Cruz')
    expect(html).toContain('Alley cleared')
    expect(html).toContain('tag-row-retired')
  })

  it('marks the retired row by shape as well as by word', () => {
    expect(render([tag({ is_active: false, retired_at: '2026-11-02T12:30:00Z' })]))
      .toContain('tag-row-retired')
    expect(render([tag()])).not.toContain('tag-row-retired')
  })

  it('offers no control at all in a row', () => {
    const html = render([tag(), tag({ id: 2, is_active: false })])

    expect(html).not.toContain('<button')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('<input')
  })
})

describe('access tag list screen', () => {
  const view = read('./AccessTagList.tsx')

  it('reads the list from the server through one filter encoding', () => {
    expect(view).toContain('listTags(token, {')
    expect(view).toContain('setTags(response.data)')
    expect(view).toContain('setTotal(response.meta.total)')
  })

  it('drops the session when the server refuses the read', () => {
    expect(view).toContain('err instanceof AuthApiError && err.status === 401')
    expect(view).toContain('await logout()')
  })

  it('offers only narrowing controls and the page steps', () => {
    expect(view).not.toContain('<form')
    expect(view).toContain('Try again')
    expect(view).toContain('Previous')
    expect(view).toContain('Next')
    expect(view).not.toContain('/retire')
    expect(view).not.toContain('submitTag')
  })

  it('lands on active constraints and can widen to retired ones', () => {
    expect(view).toContain("is_active: '1'")
    expect(view).toContain('<option value="0">Retired only</option>')
    expect(view).toContain('<option value="">Active and retired</option>')
  })

  it('labels every filter through the shared primitives', () => {
    expect(view).toContain('<Field id="tag-filter-type" label="Constraint type">')
    expect(view).toContain('<Field id="tag-filter-state" label="State">')
    expect(view).toContain('<Field id="tag-filter-barangay" label="Barangay">')
    expect(view).toContain('<Spinner label="Loading access tags…" />')
    expect(view).toContain('<EmptyState title="No access tags found." />')
    expect(view).toContain('<Alert tone="danger">{error}</Alert>')
  })

  it('takes its type labels from the server rather than a local list', () => {
    expect(view).toContain('useAccessTagTypes(true)')
    expect(view).toContain('types.options.map(')
  })
})
