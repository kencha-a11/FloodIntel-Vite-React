import type { AlertLevel, FloodType } from '../types/report'
import { ALERT_LEVEL_ORDER, ALERT_TIERS } from './vocabulary'

export type AlertLevelValue = AlertLevel

export type FloodTypeValue = FloodType

export const ALERT_LEVELS: { value: AlertLevelValue; label: string }[] = ALERT_LEVEL_ORDER.map(
  (value) => ({ value, label: ALERT_TIERS[value].label }),
)

export const FLOOD_TYPES: { value: FloodTypeValue; label: string }[] = [
  { value: 'river_overflow', label: 'River overflow' },
  { value: 'ponding', label: 'Ponding' },
]
