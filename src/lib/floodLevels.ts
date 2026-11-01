import type { FloodLevel } from '../types/report'
import { LEGACY_DEPTH_LABELS } from './vocabulary'

const DEPTH_ORDER: FloodLevel[] = ['ankle', 'knee', 'waist', 'chest', 'neck']

export const FLOOD_LEVELS: { value: FloodLevel; label: string }[] = DEPTH_ORDER.map(
  (value) => ({ value, label: LEGACY_DEPTH_LABELS[value] }),
)

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export const SAFE_PHOTO_BYTES = 4_900_000

export const TARGET_PHOTO_BYTES = 1024 * 1024

export const RESCUE_PHOTO_BYTES = 512 * 1024

export const LAST_RESORT_PHOTO_BYTES = 256 * 1024

export const MAX_PHOTO_EDGE = 2048

export const MIN_PHOTO_EDGE = 320

export const PHOTO_QUALITY_STEPS = [
  0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3,
]
