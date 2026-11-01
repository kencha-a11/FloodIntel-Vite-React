import type { AccessInterface, User } from '../types/auth'
import { userPermissions, type Permissions } from './permissions'

/*
 * The interface returned at sign-in chooses the shell's sections and its
 * landing section (FR-104). This is presentation only: every section's
 * requests are authorized by the server, and a hidden section is never
 * evidence that a request would be refused (D-08, D-112).
 */

export type AppView = 'capture' | 'impact' | 'reports' | 'map' | 'tokens'

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
  'tokens',
  'capture',
  'impact',
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
    case 'tokens':
      return 'API tokens'
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

  if (permissions.manageTokens) {
    reachable.add('tokens')
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
