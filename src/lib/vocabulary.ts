import type { AlertLevel, FloodLevel, FloodReportStatus } from '../types/report'

/*
 * The one place a report status, alert tier, data source, or depth level
 * becomes text or tone (design rule 2, D-05). Screens read these mappings
 * rather than printing an enum value or picking a colour themselves.
 */

export type ReportStatusTone = 'info' | 'success' | 'warning' | 'danger'

export type SeverityLevel = 1 | 2 | 3 | 4 | 5

export const REPORT_STATUSES: FloodReportStatus[] = [
  'submitted',
  'validated',
  'returned',
  'rejected',
]

export const REPORT_STATUS_LABELS: Record<FloodReportStatus, string> = {
  submitted: 'Submitted',
  validated: 'Validated',
  returned: 'Returned',
  rejected: 'Rejected',
}

const REPORT_STATUS_TONES: Record<FloodReportStatus, ReportStatusTone> = {
  submitted: 'info',
  validated: 'success',
  returned: 'warning',
  rejected: 'danger',
}

export function reportStatusLabel(status: FloodReportStatus): string {
  return REPORT_STATUS_LABELS[status]
}

export function reportStatusTone(status: FloodReportStatus): ReportStatusTone {
  return REPORT_STATUS_TONES[status]
}

export interface AlertTier {
  tier: 1 | 2 | 3
  label: string
  short: string
  tone: `alert-${1 | 2 | 3}`
}

export const ALERT_LEVEL_ORDER: AlertLevel[] = ['alert', 'get_ready', 'red_alert']

export const ALERT_TIERS: Record<AlertLevel, AlertTier> = {
  alert: { tier: 1, label: 'Level 1 — Alert', short: 'Alert', tone: 'alert-1' },
  get_ready: { tier: 2, label: 'Level 2 — Get Ready', short: 'Get Ready', tone: 'alert-2' },
  red_alert: { tier: 3, label: 'Level 3 — Red Alert', short: 'Red Alert', tone: 'alert-3' },
}

export function alertTierLabel(level: AlertLevel): string {
  return ALERT_TIERS[level].label
}

export function alertTierShortLabel(level: AlertLevel): string {
  return ALERT_TIERS[level].short
}

export function alertTierTone(level: AlertLevel): AlertTier['tone'] {
  return ALERT_TIERS[level].tone
}

export type DataSource = 'reported' | 'derived' | 'predicted'

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  reported: 'Reported',
  derived: 'Derived',
  predicted: 'Predicted',
}

export const DATA_SOURCE_NOTES: Record<DataSource, string> = {
  reported: 'Direct field observation, linked to the report and its timestamps.',
  derived: 'Computed from the DEM and the reported depth; never labeled as reported.',
  predicted: 'Model output, shown only with its caveat. Nothing produces it yet.',
}

export function dataSourceLabel(source: DataSource): string {
  return DATA_SOURCE_LABELS[source]
}

/*
 * D-05 keeps the five-step depth scale out of the alert vocabulary: it is a
 * legacy field, labelled as such, and never mapped onto the three tiers.
 */
export const LEGACY_DEPTH_LABEL = 'Legacy depth'

export const LEGACY_DEPTH_NOTE = 'Legacy five-step depth scale, not an alert tier (D-05).'

export const LEGACY_DEPTH_LABELS: Record<FloodLevel, string> = {
  ankle: 'Ankle-deep',
  knee: 'Knee-deep',
  waist: 'Waist-deep',
  chest: 'Chest-deep',
  neck: 'Neck-deep or above',
}

export function floodLevelLabel(level: FloodLevel | null): string | null {
  return level === null ? null : LEGACY_DEPTH_LABELS[level]
}

export function legacyDepthLevel(value: number | null): SeverityLevel | null {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
    ? value
    : null
}
