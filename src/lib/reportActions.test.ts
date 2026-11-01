import { describe, expect, it } from 'vitest'
import {
  availableReportActions,
  overrideTargets,
} from './reportActions'

const STAFF = ['validate-report', 'consolidate-reports']
const OFFICER = [
  'validate-report',
  'override-validation',
  'manage-users',
]
const TANOD = ['submit-flood-report', 'view-own-barangay']

describe('availableReportActions', () => {
  it('offers validate and return to staff on a submitted report', () => {
    expect(
      availableReportActions({ status: 'submitted' }, STAFF, 'mdrrmo_staff'),
    ).toEqual({
      canValidate: true,
      canReturn: true,
      canOverride: false,
      canReject: false,
    })
  })

  it('offers reject and validate to an officer on a submitted report', () => {
    expect(
      availableReportActions({ status: 'submitted' }, OFFICER, 'mdrrmo_officer'),
    ).toMatchObject({
      canValidate: true,
      canReject: true,
      canOverride: false,
    })
  })

  it('offers only override to an officer once a decision exists', () => {
    expect(
      availableReportActions({ status: 'validated' }, OFFICER, 'mdrrmo_officer'),
    ).toEqual({
      canValidate: false,
      canReturn: false,
      canOverride: true,
      canReject: false,
    })
    expect(
      availableReportActions({ status: 'returned' }, OFFICER, 'mdrrmo_officer'),
    ).toMatchObject({
      canOverride: true,
      canValidate: false,
    })
  })

  it('offers nothing to a field reporter or on a rejected report', () => {
    expect(
      availableReportActions({ status: 'submitted' }, TANOD, 'barangay_tanod'),
    ).toEqual({
      canValidate: false,
      canReturn: false,
      canOverride: false,
      canReject: false,
    })
    expect(
      availableReportActions({ status: 'rejected' }, OFFICER, 'mdrrmo_officer'),
    ).toEqual({
      canValidate: false,
      canReturn: false,
      canOverride: false,
      canReject: false,
    })
  })

  it('keys reject on the officer role, not on manage-users', () => {
    expect(
      availableReportActions(
        { status: 'submitted' },
        ['validate-report', 'manage-users'],
        'mdrrmo_staff',
      ),
    ).toMatchObject({ canReject: false })
    expect(
      availableReportActions(
        { status: 'submitted' },
        ['validate-report'],
        'mdrrmo_officer',
      ),
    ).toMatchObject({ canReject: true })
  })
})

describe('overrideTargets', () => {
  it('matches the transition table for each decided status', () => {
    expect(overrideTargets('validated')).toEqual(['returned', 'rejected'])
    expect(overrideTargets('returned')).toEqual(['validated', 'rejected'])
  })

  it('has no target for an undecided or terminal report', () => {
    expect(overrideTargets('submitted')).toEqual([])
    expect(overrideTargets('rejected')).toEqual([])
  })
})
