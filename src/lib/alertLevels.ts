export type AlertLevelValue = 'alert' | 'get_ready' | 'red_alert'

export type FloodTypeValue = 'river_overflow' | 'ponding'

export const ALERT_LEVELS: { value: AlertLevelValue; label: string }[] = [
  { value: 'alert', label: 'Level 1 — Alert' },
  { value: 'get_ready', label: 'Level 2 — Get Ready' },
  { value: 'red_alert', label: 'Level 3 — Red Alert' },
]

export const FLOOD_TYPES: { value: FloodTypeValue; label: string }[] = [
  { value: 'river_overflow', label: 'River overflow' },
  { value: 'ponding', label: 'Ponding' },
]