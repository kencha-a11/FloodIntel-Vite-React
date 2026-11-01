import type { User } from '../types/auth'

/*
 * The one place the client turns an account into control-level permissions
 * (FR-104, D-113). Every flag names the server rule it mirrors; the client
 * decides nothing, and a hidden control is never evidence that a request would
 * be refused (D-08).
 */

export interface Permissions {
  fileFloodReport: boolean
  fileImpactReport: boolean
  viewOwnBarangay: boolean
  viewAllBarangays: boolean
  reviewReports: boolean
  overrideValidation: boolean
  viewValidatedFeed: boolean
  rejectReports: boolean
  manageTokens: boolean
  manageUsers: boolean
}

const SUBMIT_FLOOD_REPORT = 'submit-flood-report'
const SUBMIT_IMPACT_REPORT = 'submit-impact-report'
const VIEW_OWN_BARANGAY = 'view-own-barangay'
const VIEW_ALL_BARANGAYS = 'view-all-barangays'
const VALIDATE_REPORT = 'validate-report'
const OVERRIDE_VALIDATION = 'override-validation'
const VIEW_VALIDATED_REPORTS = 'view-validated-reports'
const MANAGE_USERS = 'manage-users'

export function userPermissions(
  user: Pick<User, 'interface' | 'abilities' | 'role'>,
): Permissions {
  const abilities = user.abilities ?? []

  return {
    fileFloodReport: abilities.includes(SUBMIT_FLOOD_REPORT),
    fileImpactReport: abilities.includes(SUBMIT_IMPACT_REPORT),
    viewOwnBarangay: abilities.includes(VIEW_OWN_BARANGAY),
    viewAllBarangays: abilities.includes(VIEW_ALL_BARANGAYS),
    reviewReports: abilities.includes(VALIDATE_REPORT),
    overrideValidation: abilities.includes(OVERRIDE_VALIDATION),
    viewValidatedFeed: abilities.includes(VIEW_VALIDATED_REPORTS),
    // Rejection is fenced by the officer-only route group (D-23, FR-108), so
    // the role is the server rule here rather than an ability.
    rejectReports: user.role === 'mdrrmo_officer',
    // The interface decides whether the screen exists (FR-104); the server
    // authorizes every token request independently.
    manageTokens: user.interface === 'command_center',
    // FR-103 names ManageUsers as the authority for role management, and the
    // matrix endpoint is gated on the same ability (D-114).
    manageUsers: abilities.includes(MANAGE_USERS),
  }
}
