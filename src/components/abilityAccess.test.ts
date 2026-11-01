import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

/*
 * D-113: element visibility comes from one permission result keyed on what the
 * server checks. Components consume it; none of them re-reads the raw account.
 */

const COMPONENTS = readdirSync(new URL('.', import.meta.url))
  .filter((name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx'))
  .map((name) => ({ name, source: read(`./${name}`) }))

const ABILITY_LITERALS = [
  'validate-report',
  'override-validation',
  'generate-provincial-report',
  'manage-users',
  'view-all-barangays',
  'view-validated-reports',
  'submit-flood-report',
  'submit-impact-report',
  'view-own-barangay',
  'update-rescue-status',
]

describe('permission-derived element visibility', () => {
  it('derives every control in the policy module', () => {
    const permissions = read('../lib/permissions.ts')

    expect(permissions).toContain('export function userPermissions(')
    expect(permissions).toContain(`rejectReports: user.role === 'mdrrmo_officer'`)
    expect(permissions).toContain(
      `manageTokens: user.interface === 'command_center'`,
    )
    expect(permissions).toContain('manageUsers: abilities.includes(MANAGE_USERS)')
  })

  it('keeps the raw account out of the components', () => {
    for (const { name, source } of COMPONENTS) {
      expect(source, name).not.toMatch(/\buser\??\.abilities\b/)
      expect(source, name).not.toMatch(/\buser\??\.role\b/)
    }

    const app = read('../App.tsx')

    expect(app).not.toMatch(/\buser\.abilities\b/)
    expect(app).not.toMatch(/\buser\.role\b/)
  })

  it('keeps ability strings in the policy module only', () => {
    for (const { name, source } of COMPONENTS) {
      for (const literal of ABILITY_LITERALS) {
        expect(source, `${name} · ${literal}`).not.toContain(literal)
      }
    }

    const app = read('../App.tsx')

    for (const literal of ABILITY_LITERALS) {
      expect(app).not.toContain(literal)
    }
  })

  it('passes the one permission result to the consumers', () => {
    const app = read('../App.tsx')
    const workspace = read('./ReviewWorkspace.tsx')
    const list = read('./ReportList.tsx')
    const detail = read('./ReportDetail.tsx')

    expect(app).toContain('permissions={access.permissions}')
    expect(app).toContain(
      'canFileImpact={access.permissions.fileImpactReport}',
    )
    expect(app).toContain(
      'canViewValidatedFeed={access.permissions.viewValidatedFeed}',
    )

    expect(workspace).toContain('permissions: Permissions')
    expect(workspace).toContain('<ReportList')
    expect(workspace).toContain('permissions={permissions}')

    expect(list).toContain('permissions: Permissions')
    expect(list).toContain('{permissions.reviewReports && <DeadlineBar />}')
    expect(list).toContain('{permissions.reviewReports && (')
    expect(list).toContain('{permissions.viewAllBarangays && (')

    expect(detail).toContain('userPermissions(user)')
    expect(detail).toContain('availableReportActions(report, permissions)')
    expect(detail).toContain('canFileCorrection(report, permissions)')
  })
})
