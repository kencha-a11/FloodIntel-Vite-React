import type { RealtimeLatencySummary } from '../types/realtime'

export function describeLatencySummary(
  summary: RealtimeLatencySummary,
): string {
  const window = `${summary.windowHours}h`

  if (summary.samples === 0) {
    return `Realtime propagation (${window}): no samples yet.`
  }

  const parts = [
    `Realtime propagation (${window}): median ${formatLatency(summary.medianMs)}, max ${formatLatency(summary.maxMs)}`,
    `${summary.samples} samples`,
    `${summary.excluded} excluded`,
  ]

  if (summary.breaches > 0) {
    parts.push(`${summary.breaches} over ${summary.boundMs / 1000}s`)
  }

  return parts.join(' · ')
}

export function formatLatency(milliseconds: number | null): string {
  if (milliseconds === null) {
    return 'none'
  }

  if (milliseconds < 1_000) {
    return `${milliseconds} ms`
  }

  return `${(milliseconds / 1_000).toFixed(1)} s`
}
