import { describe, expect, it } from 'vitest'
import {
  isViewReachable,
  resolveView,
  viewAccess,
  type AppView,
  type ViewAccess,
} from './viewAccess'
import type { AccessInterface, User, UserRole } from '../types/auth'

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
  role: UserRole,
  overrides: Partial<User> = {},
): Pick<User, 'interface' | 'abilities' | 'role'> {
  return { interface: iface, abilities, role, ...overrides }
}

function views(access: ViewAccess): AppView[] {
  return access.sections.map((section) => section.view)
}

describe('viewAccess', () => {
  it('lands a command-center account on the review queue', () => {
    const access = viewAccess(
      account('command_center', OFFICER, 'mdrrmo_officer'),
    )

    expect(access.iface).toBe('command_center')
    expect(access.defaultView).toBe('reports')
    expect(views(access)).toEqual(['reports', 'map', 'tags', 'tokens', 'roles'])
    expect(access.sections[0].label).toBe('Review queue')
    expect(access.sections[2].label).toBe('Access tags')
    expect(access.sections[4].label).toBe('Roles & permissions')
    expect(access.permissions.reviewReports).toBe(true)
    expect(access.permissions.fileImpactReport).toBe(false)
  })

  it('gives the staff account the same sections, without the matrix, and no filing', () => {
    const access = viewAccess(account('command_center', STAFF, 'mdrrmo_staff'))

    expect(views(access)).toEqual(['reports', 'map', 'tags', 'tokens'])
    expect(access.permissions.fileImpactReport).toBe(false)
    expect(access.permissions.reviewReports).toBe(true)
    expect(access.permissions.manageUsers).toBe(false)
  })

  it('lands a captain on capture and keeps the barangay views', () => {
    const access = viewAccess(
      account('field_reporter', CAPTAIN, 'barangay_captain'),
    )

    expect(access.defaultView).toBe('capture')
    expect(views(access)).toEqual(['capture', 'impact', 'reports'])
    expect(access.sections[2].label).toBe('Reports')
    expect(access.permissions.reviewReports).toBe(false)
    expect(access.permissions.fileImpactReport).toBe(true)
  })

  it('keeps the tanod out of filing an impact report but in its list', () => {
    const access = viewAccess(account('field_reporter', TANOD, 'barangay_tanod'))

    expect(views(access)).toEqual(['capture', 'impact', 'reports'])
    expect(access.permissions.fileImpactReport).toBe(false)
    expect(access.permissions.viewOwnBarangay).toBe(true)
  })

  it('lands the rescue leader on the report list with the map and no capture', () => {
    const access = viewAccess(
      account('field_reporter', RESCUE_LEADER, 'rescue_leader'),
    )

    expect(access.defaultView).toBe('reports')
    expect(views(access)).toEqual(['reports', 'map'])
    expect(access.permissions.fileImpactReport).toBe(false)
  })

  it('never offers token management to a field account', () => {
    for (const [abilities, role] of [
      [CAPTAIN, 'barangay_captain'],
      [TANOD, 'barangay_tanod'],
      [RESCUE_LEADER, 'rescue_leader'],
    ] as const) {
      const access = viewAccess(account('field_reporter', abilities, role))

      expect(access.sections).not.toContainEqual(
        expect.objectContaining({ view: 'tokens' }),
      )
      expect(access.permissions.manageTokens).toBe(false)
    }
  })

  it('never offers the role matrix to a field account, even with manage-users', () => {
    const access = viewAccess(
      account(
        'field_reporter',
        [...CAPTAIN, 'manage-users'],
        'barangay_captain',
      ),
    )

    expect(views(access)).toEqual(['capture', 'impact', 'reports'])
    expect(access.permissions.manageUsers).toBe(true)
    expect(isViewReachable(access, 'roles')).toBe(false)
  })

  it('offers the tag list only in the command center, even with the read ability', () => {
    const officer = viewAccess(
      account('command_center', OFFICER, 'mdrrmo_officer'),
    )
    const captain = viewAccess(
      account(
        'field_reporter',
        [...CAPTAIN, 'view-all-barangays'],
        'barangay_captain',
      ),
    )

    expect(isViewReachable(officer, 'tags')).toBe(true)
    expect(captain.permissions.viewAllBarangays).toBe(true)
    expect(isViewReachable(captain, 'tags')).toBe(false)
  })

  it('offers the report list alone when no ability is held', () => {
    const access = viewAccess(account('field_reporter', [], 'barangay_tanod'))

    expect(views(access)).toEqual(['reports'])
    expect(access.defaultView).toBe('reports')
  })

  it('ignores abilities the server never granted', () => {
    const access = viewAccess(
      account(
        'field_reporter',
        ['manage-everything', 'monitor-dashboard'],
        'barangay_tanod',
      ),
    )

    expect(views(access)).toEqual(['reports'])
  })

  it('reports reachability from the section list, not a second rule', () => {
    const officer = viewAccess(
      account('command_center', OFFICER, 'mdrrmo_officer'),
    )
    const captain = viewAccess(
      account('field_reporter', CAPTAIN, 'barangay_captain'),
    )

    expect(isViewReachable(officer, 'map')).toBe(true)
    expect(isViewReachable(officer, 'capture')).toBe(false)
    expect(isViewReachable(captain, 'capture')).toBe(true)
    expect(isViewReachable(captain, 'map')).toBe(false)
    expect(isViewReachable(captain, 'tokens')).toBe(false)
  })
})

describe('resolveView', () => {
  it('keeps a requested section the account may open', () => {
    const access = viewAccess(
      account('field_reporter', CAPTAIN, 'barangay_captain'),
    )

    expect(resolveView(access, 'impact')).toBe('impact')
  })

  it('keeps the requested matrix for the account that may open it', () => {
    const officer = viewAccess(
      account('command_center', OFFICER, 'mdrrmo_officer'),
    )

    expect(resolveView(officer, 'roles')).toBe('roles')
  })

  it('falls back to the default instead of rendering a section it cannot open', () => {
    const officer = viewAccess(
      account('command_center', OFFICER, 'mdrrmo_officer'),
    )
    const captain = viewAccess(
      account('field_reporter', CAPTAIN, 'barangay_captain'),
    )

    expect(resolveView(officer, 'capture')).toBe('reports')
    expect(resolveView(captain, 'map')).toBe('capture')
    expect(resolveView(captain, 'tokens')).toBe('capture')
    expect(resolveView(captain, 'roles')).toBe('capture')
  })

  it('resolves no request to the interface default', () => {
    const officer = viewAccess(account('command_center', STAFF, 'mdrrmo_staff'))
    const leader = viewAccess(
      account('field_reporter', RESCUE_LEADER, 'rescue_leader'),
    )

    expect(resolveView(officer, null)).toBe('reports')
    expect(resolveView(leader, null)).toBe('reports')
  })
})
