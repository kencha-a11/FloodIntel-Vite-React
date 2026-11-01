import { describe, expect, it } from 'vitest'
import {
  isViewReachable,
  resolveView,
  viewAccess,
  type AppView,
  type ViewAccess,
} from './viewAccess'
import type { AccessInterface, User } from '../types/auth'

const OFFICER = [
  'validate-report',
  'override-validation',
  'generate-provincial-report',
  'manage-users',
  'view-all-barangays',
  'view-validated-reports',
]
const STAFF = [
  'validate-report',
  'consolidate-reports',
  'dispatch-assets',
  'view-all-barangays',
  'view-validated-reports',
]
const CAPTAIN = [
  'submit-impact-report',
  'submit-flood-report',
  'view-own-barangay',
]
const TANOD = ['submit-flood-report', 'view-own-barangay']
const RESCUE_LEADER = ['view-validated-reports', 'update-rescue-status']

function account(
  iface: AccessInterface,
  abilities: string[],
  overrides: Partial<User> = {},
): Pick<User, 'interface' | 'abilities'> {
  return { interface: iface, abilities, ...overrides }
}

function views(access: ViewAccess): AppView[] {
  return access.sections.map((section) => section.view)
}

describe('viewAccess', () => {
  it('lands a command-center account on the review queue', () => {
    const access = viewAccess(account('command_center', OFFICER))

    expect(access.iface).toBe('command_center')
    expect(access.defaultView).toBe('reports')
    expect(views(access)).toEqual(['reports', 'map', 'tokens'])
    expect(access.sections[0].label).toBe('Review queue')
    expect(access.canReview).toBe(true)
    expect(access.canFileImpact).toBe(false)
  })

  it('gives the staff account the same sections and no filing', () => {
    const access = viewAccess(account('command_center', STAFF))

    expect(views(access)).toEqual(['reports', 'map', 'tokens'])
    expect(access.canFileImpact).toBe(false)
  })

  it('lands a captain on capture and keeps the barangay views', () => {
    const access = viewAccess(account('field_reporter', CAPTAIN))

    expect(access.defaultView).toBe('capture')
    expect(views(access)).toEqual(['capture', 'impact', 'reports'])
    expect(access.sections[2].label).toBe('Reports')
    expect(access.canReview).toBe(false)
    expect(access.canFileImpact).toBe(true)
  })

  it('keeps the tanod out of filing an impact report but in its list', () => {
    const access = viewAccess(account('field_reporter', TANOD))

    expect(views(access)).toEqual(['capture', 'impact', 'reports'])
    expect(access.canFileImpact).toBe(false)
  })

  it('lands the rescue leader on the report list with the map and no capture', () => {
    const access = viewAccess(account('field_reporter', RESCUE_LEADER))

    expect(access.defaultView).toBe('reports')
    expect(views(access)).toEqual(['reports', 'map'])
    expect(access.canFileImpact).toBe(false)
  })

  it('never offers token management to a field account', () => {
    for (const abilities of [CAPTAIN, TANOD, RESCUE_LEADER]) {
      expect(viewAccess(account('field_reporter', abilities)).sections).not.toContainEqual(
        expect.objectContaining({ view: 'tokens' }),
      )
    }
  })

  it('offers the report list alone when no ability is held', () => {
    const access = viewAccess(account('field_reporter', []))

    expect(views(access)).toEqual(['reports'])
    expect(access.defaultView).toBe('reports')
  })

  it('ignores abilities the server never granted', () => {
    const access = viewAccess(
      account('field_reporter', ['manage-everything', 'monitor-dashboard']),
    )

    expect(views(access)).toEqual(['reports'])
  })

  it('reports reachability from the section list, not a second rule', () => {
    const officer = viewAccess(account('command_center', OFFICER))
    const captain = viewAccess(account('field_reporter', CAPTAIN))

    expect(isViewReachable(officer, 'map')).toBe(true)
    expect(isViewReachable(officer, 'capture')).toBe(false)
    expect(isViewReachable(captain, 'capture')).toBe(true)
    expect(isViewReachable(captain, 'map')).toBe(false)
    expect(isViewReachable(captain, 'tokens')).toBe(false)
  })
})

describe('resolveView', () => {
  it('keeps a requested section the account may open', () => {
    const access = viewAccess(account('field_reporter', CAPTAIN))

    expect(resolveView(access, 'impact')).toBe('impact')
  })

  it('falls back to the default instead of rendering a section it cannot open', () => {
    const officer = viewAccess(account('command_center', OFFICER))
    const captain = viewAccess(account('field_reporter', CAPTAIN))

    expect(resolveView(officer, 'capture')).toBe('reports')
    expect(resolveView(captain, 'map')).toBe('capture')
    expect(resolveView(captain, 'tokens')).toBe('capture')
  })

  it('resolves no request to the interface default', () => {
    const officer = viewAccess(account('command_center', STAFF))
    const leader = viewAccess(account('field_reporter', RESCUE_LEADER))

    expect(resolveView(officer, null)).toBe('reports')
    expect(resolveView(leader, null)).toBe('reports')
  })
})
