import type { FloodLevel } from '../types/report'

export const FLOOD_LEVELS: { value: FloodLevel; label: string }[] = [
  { value: 'ankle', label: 'Ankle-deep' },
  { value: 'knee', label: 'Knee-deep' },
  { value: 'waist', label: 'Waist-deep' },
  { value: 'chest', label: 'Chest-deep' },
  { value: 'neck', label: 'Neck-deep or above' },
]

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
