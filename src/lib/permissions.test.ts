import { describe, expect, it } from 'vitest'
import { userPermissions } from './permissions'
import type { AccessInterface, UserRole } from '../types/auth'

/*
 * FR-105's grant matrix (server/app/Enums/UserRole.php). The client mirrors it
 * so the visible controls match what the server would allow; the server stays
 * the authority (D-08, D-113).
 */

interface Account {
  role: UserRole
  interface: AccessInterface
  abilities: string[]
}

const OFFICER: Account = {
  role: 'mdrrmo_officer',
  interface: 'command_center',
  abilities: [
    'validate-report',
    'override-validation',
    'generate-provincial-report',
    'manage-users',
    'view-all-barangays',
    'view-validated-reports',
  ],
}
const STAFF: Account = {
  role: 'mdrrmo_staff',
  interface: 'command_center',
  abilities: [
    'validate-report',
    'consolidate-reports',
    'dispatch-assets',
    'view-all-barangays',
    'view-validated-reports',
  ],
}
const CAPTAIN: Account = {
  role: 'barangay_captain',
  interface: 'field_reporter',
  abilities: [
    'submit-impact-report',
    'submit-flood-report',
    'record-access-tag',
    'view-own-barangay',
  ],
}
const TANOD: Account = {
  role: 'barangay_tanod',
  interface: 'field_reporter',
  abilities: ['submit-flood-report', 'record-access-tag', 'view-own-barangay'],
}
const RESCUE_LEADER: Account = {
  role: 'rescue_leader',
  interface: 'field_reporter',
  abilities: ['view-validated-reports', 'update-rescue-status'],
}

const COMMAND_CENTER = {
  fileFloodReport: false,
  fileImpactReport: false,
  recordAccessTag: false,
  viewOwnBarangay: false,
  reviewReports: true,
  viewAllBarangays: true,
  viewValidatedFeed: true,
  rejectReports: false,
  manageTokens: true,
  prepareSitrep: false,
  issueSitrep: false,
}

describe('userPermissions', () => {
  it('derives the officer controls from the grant matrix', () => {
    expect(userPermissions(OFFICER)).toEqual({
      ...COMMAND_CENTER,
      overrideValidation: true,
      rejectReports: true,
      manageUsers: true,
      prepareSitrep: true,
      issueSitrep: true,
    })
  })

  it('withholds override, reject, and user management from staff', () => {
    expect(userPermissions(STAFF)).toEqual({
      ...COMMAND_CENTER,
      overrideValidation: false,
      manageUsers: false,
      prepareSitrep: true,
      issueSitrep: false,
    })
  })

  it('gives the captain both filing screens and no review controls', () => {
    expect(userPermissions(CAPTAIN)).toEqual({
      fileFloodReport: true,
      fileImpactReport: true,
      recordAccessTag: true,
      viewOwnBarangay: true,
      viewAllBarangays: false,
      reviewReports: false,
      overrideValidation: false,
      viewValidatedFeed: false,
      rejectReports: false,
      manageTokens: false,
      manageUsers: false,
      prepareSitrep: false,
      issueSitrep: false,
    })
  })

  it('gives the tanod no impact filing but keeps the barangay view', () => {
    expect(userPermissions(TANOD)).toEqual({
      ...userPermissions(CAPTAIN),
      fileImpactReport: false,
    })
  })

  it('gives the rescue leader the validated feed only', () => {
    expect(userPermissions(RESCUE_LEADER)).toEqual({
      fileFloodReport: false,
      fileImpactReport: false,
      recordAccessTag: false,
      viewOwnBarangay: false,
      viewAllBarangays: false,
      reviewReports: false,
      overrideValidation: false,
      viewValidatedFeed: true,
      rejectReports: false,
      manageTokens: false,
      manageUsers: false,
      prepareSitrep: false,
      issueSitrep: false,
    })
  })

  it('keys tag recording on the ability FR-118 grants to the field roles', () => {
    expect(userPermissions(CAPTAIN).recordAccessTag).toBe(true)
    expect(userPermissions(TANOD).recordAccessTag).toBe(true)
    expect(
      userPermissions({
        role: 'barangay_tanod',
        interface: 'field_reporter',
        abilities: ['submit-flood-report'],
      }).recordAccessTag,
    ).toBe(false)
  })

  it('ignores abilities the server never granted', () => {
    expect(
      userPermissions({
        role: 'barangay_tanod',
        interface: 'field_reporter',
        abilities: ['manage-everything', 'monitor-dashboard'],
      }),
    ).toMatchObject({
      fileFloodReport: false,
      reviewReports: false,
      overrideValidation: false,
      rejectReports: false,
    })
  })

  it('treats a missing ability list as no grant', () => {
    expect(
      userPermissions({
        role: 'barangay_tanod',
        interface: 'field_reporter',
        abilities: undefined as unknown as string[],
      }),
    ).toMatchObject({ fileFloodReport: false, reviewReports: false })
  })

  it('keys rejection on the role the server fences, not on an ability', () => {
    expect(
      userPermissions({
        role: 'mdrrmo_officer',
        interface: 'command_center',
        abilities: [],
      }).rejectReports,
    ).toBe(true)
    expect(
      userPermissions({
        role: 'mdrrmo_staff',
        interface: 'command_center',
        abilities: ['validate-report', 'manage-users'],
      }).rejectReports,
    ).toBe(false)
  })

  it('keys token management on the interface the shell is chosen from', () => {
    expect(
      userPermissions({
        role: 'mdrrmo_officer',
        interface: 'field_reporter',
        abilities: [],
      }).manageTokens,
    ).toBe(false)
  })

  it('keys the role matrix on manage-users, the ability the endpoint checks', () => {
    expect(
      userPermissions({
        role: 'mdrrmo_staff',
        interface: 'command_center',
        abilities: ['manage-users'],
      }).manageUsers,
    ).toBe(true)
    expect(
      userPermissions({
        role: 'mdrrmo_officer',
        interface: 'command_center',
        abilities: ['validate-report'],
      }).manageUsers,
    ).toBe(false)
  })
})
