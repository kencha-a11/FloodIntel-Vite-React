import { describe, expect, it } from 'vitest'
import { buildTagQuery } from './tagApi'
import type { AccessTagFilters } from '../types/accessTag'

const BASE: AccessTagFilters = {
  barangay_id: '',
  type: '',
  is_active: '1',
  from: '',
  to: '',
  per_page: 15,
  page: 1,
}

describe('buildTagQuery', () => {
  it('sends the default state and the page, and nothing else', () => {
    expect(buildTagQuery(BASE)).toBe('is_active=1&per_page=15&page=1')
  })

  it('omits a filter that is not narrowed rather than sending a sentinel', () => {
    const query = buildTagQuery(BASE)

    expect(query).not.toContain('barangay_id')
    expect(query).not.toContain('from=')
    expect(query).not.toContain('to=')
  })

  it('sends each narrowed filter once, with the retired state as 0', () => {
    const query = buildTagQuery({
      ...BASE,
      barangay_id: '4',
      type: 'no_vehicle_access',
      is_active: '0',
      from: '2026-11-01T00:00:00',
      to: '2026-11-02T23:59:59',
    })

    expect(query).toContain('barangay_id=4')
    expect(query).toContain('type=no_vehicle_access')
    expect(query).toContain('is_active=0')
    expect(query).toContain('from=2026-11-01T00%3A00%3A00')
    expect(query).toContain('to=2026-11-02T23%3A59%3A59')
  })

  it('sends all three states as the absence of a state filter', () => {
    expect(buildTagQuery({ ...BASE, is_active: '' })).not.toContain('is_active')
  })

  it('carries the page the user asked for', () => {
    expect(buildTagQuery({ ...BASE, page: 3 })).toContain('page=3')
  })
})
