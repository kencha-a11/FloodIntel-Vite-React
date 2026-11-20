import type { AccessInterface, User } from '../types/auth'
import { userPermissions, type Permissions } from './permissions'

/*
 * The interface returned at sign-in chooses the shell's sections and its
 * landing section (FR-104). This is presentation only: every section's
 * requests are authorized by the server, and a hidden section is never
 * evidence that a request would be refused (D-08, D-112).
 */

export type AppView =
  | 'capture'
  | 'impact'
  | 'reports'
  | 'map'
  | 'tags'
  | 'tokens'
  | 'roles'
  | 'users'
  | 'sitrep'

export interface ViewSection {
  view: AppView
  label: string
}

export interface ViewAccess {
  iface: AccessInterface
  sections: ViewSection[]
  defaultView: AppView
  permissions: Permissions
}

const FIELD_ORDER: readonly AppView[] = [
  'capture',
  'impact',
  'reports',
  'map',
  'tokens',
]
const COMMAND_ORDER: readonly AppView[] = [
  'reports',
  'map',
  'tags',
  'tokens',
  'capture',
  'impact',
  // SITREP preparation is command-center chrome (D-42, D-147): it is absent
  // from FIELD_ORDER, so a field account cannot reach it even if it held the
  // consolidation ability.
  'sitrep',
  // The matrix is command-center chrome, so it is absent from FIELD_ORDER:
  // the field interface cannot reach it even if an account held manage-users.
  'roles',
  // Assignment sits under the matrix it reads, on the same server ability.
  'users',
]

function sectionLabel(view: AppView, canReview: boolean): string {
  switch (view) {
    case 'capture':
      return 'New report'
    case 'impact':
      return 'Impact'
    case 'reports':
      return canReview ? 'Review queue' : 'Reports'
    case 'map':
      return 'Map'
    case 'tags':
      return 'Access tags'
    case 'tokens':
      return 'API tokens'
    case 'roles':
      return 'Roles & permissions'
    case 'users':
      return 'Users'
    case 'sitrep':
      return 'SITREP'
  }
}

export function viewAccess(
  user: Pick<User, 'interface' | 'abilities' | 'role'>,
): ViewAccess {
  const permissions = userPermissions(user)

  // The report list is reachable for every account: the server scopes the
  // rows by barangay or to the account's own reports (FR-106).
  const reachable = new Set<AppView>(['reports'])

  if (permissions.fileFloodReport) {
    reachable.add('capture')
  }

  if (permissions.fileImpactReport || permissions.viewOwnBarangay) {
    reachable.add('impact')
  }

  if (permissions.viewValidatedFeed) {
    reachable.add('map')
  }

  // The tag list is command-center chrome that answers the cross-barangay
  // read (FR-119, FR-120, D-132): the barangay filter is the ability the
  // server checks, and a field account reaches its own tags through capture.
  if (permissions.viewAllBarangays) {
    reachable.add('tags')
  }

  if (permissions.manageTokens) {
    reachable.add('tokens')
  }

  // The server gates /api/roles on manage-users (FR-103, D-114).
  if (permissions.manageUsers) {
    reachable.add('roles')
    // /api/users is officer-only and behind the same ability (AUTHZ-11).
    reachable.add('users')
  }

  // The SITREP workspace answers the consolidation ability (D-42, D-147);
  // the server re-checks it on every prepare, issue, and supplement request.
  if (permissions.prepareSitrep) {
    reachable.add('sitrep')
  }

  const order =
    user.interface === 'command_center' ? COMMAND_ORDER : FIELD_ORDER
  const sections = order
    .filter((view) => reachable.has(view))
    .map((view) => ({
      view,
      label: sectionLabel(view, permissions.reviewReports),
    }))
  const defaultView: AppView =
    user.interface === 'field_reporter' && reachable.has('capture')
      ? 'capture'
      : 'reports'

  return {
    iface: user.interface,
    sections,
    defaultView,
    permissions,
  }
}

export function isViewReachable(access: ViewAccess, view: AppView): boolean {
  return access.sections.some((section) => section.view === view)
}

export function resolveView(
  access: ViewAccess,
  requested: AppView | null,
): AppView {
  return requested !== null && isViewReachable(access, requested)
    ? requested
    : access.defaultView
}
