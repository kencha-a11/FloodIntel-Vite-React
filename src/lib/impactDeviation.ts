/**
 * D-13: warn, never block, when the new families count moves more than the
 * configured percentage from the previous report in the same event.
 */
export const IMPACT_DEVIATION_THRESHOLD_PERCENT = 20

export function deviationPercent(
  families: number,
  previousFamilies: number,
): number {
  return (Math.abs(families - previousFamilies) / previousFamilies) * 100
}

export function deviationWarning(
  families: number,
  previousFamilies: number | null,
  thresholdPercent = IMPACT_DEVIATION_THRESHOLD_PERCENT,
): string | null {
  if (previousFamilies === null || previousFamilies <= 0) {
    return null
  }

  const percent = deviationPercent(families, previousFamilies)

  if (percent <= thresholdPercent) {
    return null
  }

  const direction = families > previousFamilies ? 'higher' : 'lower'
  const previous =
    percent > 999 ? 'more than 999%' : `${Math.round(percent)}%`

  return `Families (${families}) is ${previous} ${direction} than the previous report (${previousFamilies}) in this event. Submit only if the count really changed.`
}
