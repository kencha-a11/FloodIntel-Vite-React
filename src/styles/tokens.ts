/*
 * Map-side mirror of the design tokens (UI-01).
 *
 * MapLibre paint properties and canvas markers need concrete values, so the
 * map palette cannot read CSS custom properties at module load. tokens.css is
 * still the source of truth: tokens.test.ts parses it and fails if any value
 * here drifts from its `--alert-*` / `--source-*` token.
 */

export type MapTierStyle = {
  tier: 1 | 2 | 3
  fill: string
  stroke: string
  text: string
  radius: number
}

export const MAP_ALERT_TIERS = {
  alert: {
    tier: 1,
    fill: '#f59e0b',
    stroke: '#b45309',
    text: '#1f2937',
    radius: 11,
  },
  get_ready: {
    tier: 2,
    fill: '#ea580c',
    stroke: '#9a3412',
    text: '#111827',
    radius: 13,
  },
  red_alert: {
    tier: 3,
    fill: '#b91c1c',
    stroke: '#7f1d1d',
    text: '#ffffff',
    radius: 15,
  },
} satisfies Record<string, MapTierStyle>

// Kept apart from MAP_ALERT_TIERS so no computed surface can borrow an alert
// color (NFR-24, D-27).
export const MAP_DERIVED = {
  fill: '#0e7490',
  fillOpacity: 0.35,
  stroke: '#155e75',
  dash: [2, 2],
} as const

/*
 * Derived · terrain elevation (FR-54): a graded ramp with one colour per
 * elevation break, so the ramp is read from its documented numbers rather than
 * from hue alone. Separate from MAP_DERIVED because two Derived layers drawn
 * the same way would merge them (FR-57).
 */
export const MAP_TERRAIN = {
  breaks: [0, 2, 5, 10],
  colors: ['#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed'],
  line: '#5b21b6',
  fillOpacity: 0.45,
} as const

/*
 * The GPS accuracy ring names the device's own uncertainty around a Reported
 * position, so it borrows the Reported source tokens rather than an alert
 * color (NFR-24). Its opacity is lower than the derived fill because the ring
 * marks a radius, not a surface.
 */
export const MAP_REPORTED_ACCURACY = {
  fill: '#ea580c',
  fillOpacity: 0.12,
  stroke: '#9a3412',
} as const

// Basemap cartography. Not a semantic UI role: these are the offline vector
// tiles' paint colors.
export const BASEMAP_COLORS = {
  background: '#f8fafc',
  barangayFill: '#e2e8f0',
  waterFill: '#bfdbfe',
  road: '#94a3b8',
  boundary: '#475569',
  landmark: '#f59e0b',
  landmarkStroke: '#ffffff',
} as const
