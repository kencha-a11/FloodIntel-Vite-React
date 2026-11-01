import type { FloodReport } from '../types/report'

/** FR-11's picker shows the newest reports first and never grows unbounded. */
export function relatedReportCandidates(
  reports: FloodReport[],
  limit = 20,
): FloodReport[] {
  return [...reports]
    .sort((left, right) => instant(right) - instant(left))
    .slice(0, limit)
}

export function toggleRelatedReport(ids: number[], id: number): number[] {
  return ids.includes(id)
    ? ids.filter((value) => value !== id)
    : [...ids, id]
}

export function relatedReportIdsLabel(
  ids: number[] | null | undefined,
): string {
  return ids === undefined || ids === null || ids.length === 0
    ? 'None'
    : ids.map((id) => `#${id}`).join(', ')
}

function instant(report: FloodReport): number {
  return Date.parse(report.reported_at ?? report.created_at)
}
