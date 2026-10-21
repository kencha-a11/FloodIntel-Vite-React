import type { FloodLevel } from '../types/report'

export const FLOOD_LEVELS: { value: FloodLevel; label: string }[] = [
  { value: 'ankle', label: 'Ankle-deep' },
  { value: 'knee', label: 'Knee-deep' },
  { value: 'waist', label: 'Waist-deep' },
  { value: 'chest', label: 'Chest-deep' },
  { value: 'neck', label: 'Neck-deep or above' },
]

export const ACCEPTED_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

export const MAX_PHOTO_SIZE_KB = 5120
