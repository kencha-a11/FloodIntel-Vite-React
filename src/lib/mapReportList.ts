import type { ValidatedFeedRow } from '../types/report'
import { ALERT_TIERS } from './vocabulary'

/*
 * FR-59: the map's list alternative is a second view of the same rows, so the
 * ordering lives here as a pure function rather than in the component. The
 * list never re-fetches; it sorts what the map already loaded.
 */

export type MapReportSort = 'tier' | 'observed' | 'received' | 'barangay'

export const MAP_REPORT_SORT_OPTIONS: Array<{ value: MapReportSort; label: string }> = [
  { value: 'tier', label: 'Highest alert tier first' },
  { value: 'observed', label: 'Most recently observed first' },
  { value: 'received', label: 'Most recently received first' },
  { value: 'barangay', label: 'Barangay name A–Z' },
]

export const MAP_REPORT_SORT_LABELS: Record<MapReportSort, string> = {
  tier: 'Highest alert tier first',
  observed: 'Most recently observed first',
  received: 'Most recently received first',
  barangay: 'Barangay name A–Z',
}

export const DEFAULT_MAP_REPORT_SORT: MapReportSort = 'tier'

function tier(row: ValidatedFeedRow): number {
  return ALERT_TIERS[row.alert_level].tier
}

function instant(value: string): number {
  const parsed = Date.parse(value)

  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function byIdDescending(a: ValidatedFeedRow, b: ValidatedFeedRow): number {
  return b.id - a.id
}

export function sortMapRows(
  rows: ValidatedFeedRow[],
  sort: MapReportSort,
): ValidatedFeedRow[] {
  return [...rows].sort((a, b) => {
    if (sort === 'tier') {
      const tierDiff = tier(b) - tier(a)

      if (tierDiff !== 0) {
        return tierDiff
      }

      const observedDiff = instant(b.observed_at) - instant(a.observed_at)

      return observedDiff !== 0 ? observedDiff : byIdDescending(a, b)
    }

    if (sort === 'observed' || sort === 'received') {
      const key = sort === 'observed' ? 'observed_at' : 'received_at'
      const diff = instant(b[key]) - instant(a[key])

      return diff !== 0 ? diff : byIdDescending(a, b)
    }

    const nameDiff = a.barangay.name.localeCompare(b.barangay.name)

    if (nameDiff !== 0) {
      return nameDiff
    }

    const tierDiff = tier(b) - tier(a)

    return tierDiff !== 0 ? tierDiff : byIdDescending(a, b)
  })
}

export function newestReceivedAt(rows: ValidatedFeedRow[]): string | null {
  let newest: string | null = null

  for (const row of rows) {
    if (newest === null || instant(row.received_at) > instant(newest)) {
      newest = row.received_at
    }
  }

  return newest
}

export function mapReportSortLabel(sort: MapReportSort): string {
  return MAP_REPORT_SORT_LABELS[sort]
}
