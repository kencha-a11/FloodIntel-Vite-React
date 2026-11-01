/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BASEMAP_COLORS,
  MAP_ALERT_TIERS,
  MAP_DERIVED,
  MAP_REPORTED_ACCURACY,
  MAP_TERRAIN,
} from './tokens'

const tokensCss = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

function parseTokens(css: string): Map<string, string> {
  const vars = new Map<string, string>()
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')

  for (const [, name, value] of withoutComments.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    vars.set(`--${name}`, value.trim())
  }

  return vars
}

const vars = parseTokens(tokensCss)

type Rgba = { r: number; g: number; b: number; a: number }

function parseColor(raw: string): Rgba {
  const value = raw.trim()

  if (value.startsWith('#')) {
    const hex = value.slice(1)
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((digit) => digit + digit)
            .join('')
        : hex

    return {
      r: Number.parseInt(full.slice(0, 2), 16),
      g: Number.parseInt(full.slice(2, 4), 16),
      b: Number.parseInt(full.slice(4, 6), 16),
      a: 1,
    }
  }

  const match = value.match(/^rgba?\(([^)]+)\)$/)

  if (match === null) {
    throw new Error(`Cannot parse colour: ${value}`)
  }

  const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number)

  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 }
}

function luminance({ r, g, b }: Rgba): number {
  const channel = (value: number) => {
    const scaled = value / 255

    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function flatten(top: Rgba, bottom: Rgba): Rgba {
  return {
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  }
}

function token(name: string): Rgba {
  const value = vars.get(name)

  if (value === undefined) {
    throw new Error(`Missing token ${name}`)
  }

  return parseColor(value)
}

function contrast(fg: Rgba, bg: Rgba): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)

  return (hi + 0.05) / (lo + 0.05)
}

function pairContrast(fgName: string, bgName: string): number {
  const fg = token(fgName)
  const raw = token(bgName)
  const bg = raw.a < 1 ? flatten(raw, token('--color-bg')) : raw

  return contrast(fg, bg)
}

const REQUIRED_TOKENS = [
  '--color-bg',
  '--color-surface',
  '--color-surface-raised',
  '--color-surface-soft',
  '--color-surface-muted',
  '--color-text',
  '--color-text-muted',
  '--color-border',
  '--color-border-strong',
  '--color-accent',
  '--color-accent-contrast',
  '--color-accent-subtle-bg',
  '--color-accent-subtle-border',
  '--color-focus',
  ...['neutral', 'info', 'success', 'warning', 'danger'].flatMap((role) => [
    `--status-${role}-bg`,
    `--status-${role}-fg`,
    `--status-${role}-border`,
  ]),
  '--status-warning-solid-bg',
  '--status-warning-solid-fg',
  '--status-danger-solid-bg',
  '--status-danger-solid-fg',
  ...[1, 2, 3].flatMap((tier) => [
    `--alert-${tier}-bg`,
    `--alert-${tier}-fg`,
    `--alert-${tier}-border`,
  ]),
  ...[1, 2, 3, 4, 5].flatMap((step) => [
    `--severity-${step}-bg`,
    `--severity-${step}-fg`,
    `--severity-${step}-border`,
  ]),
  ...['observed', 'derived'].flatMap((source) => [
    `--source-${source}-fg`,
    `--source-${source}-bg`,
    `--source-${source}-border`,
  ]),
  '--source-derived-fill-opacity',
  '--font-sans',
  '--font-heading',
  '--font-mono',
  ...['xs', 'sm', 'md', 'lg', 'xl', '2xl'].map((size) => `--text-${size}`),
  '--leading-tight',
  '--leading-normal',
  ...[1, 2, 3, 4, 6, 8, 12].map((step) => `--space-${step}`),
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--shadow-1',
  '--shadow-2',
  '--focus-ring',
  '--focus-ring-offset',
  '--duration-fast',
  '--duration-base',
  ...[1, 2, 3, 4, 5].map((step) => `--terrain-${step}`),
  '--terrain-line',
  '--terrain-fill-opacity',
]

const CONTRAST_PAIRS: [string, string][] = [
  ['--color-text', '--color-bg'],
  ['--color-text', '--color-surface-soft'],
  ['--color-text', '--color-surface-muted'],
  ['--color-text-muted', '--color-bg'],
  ['--color-text-muted', '--color-surface-soft'],
  ['--color-text-muted', '--color-surface-muted'],
  ['--color-accent', '--color-bg'],
  ['--color-accent', '--color-accent-subtle-bg'],
  ['--color-accent-contrast', '--color-accent'],
  ...['neutral', 'info', 'success', 'warning', 'danger'].map(
    (role) => [`--status-${role}-fg`, `--status-${role}-bg`] as [string, string],
  ),
  ['--status-success-fg', '--status-success-border'],
  ['--status-warning-fg', '--status-warning-border'],
  ['--status-warning-solid-fg', '--status-warning-solid-bg'],
  ['--status-danger-solid-fg', '--status-danger-solid-bg'],
  ...[1, 2, 3, 4, 5].map(
    (step) => [`--severity-${step}-fg`, `--severity-${step}-bg`] as [string, string],
  ),
  ...[1, 2, 3].map(
    (tier) => [`--alert-${tier}-fg`, `--alert-${tier}-bg`] as [string, string],
  ),
  ['--source-observed-fg', '--color-bg'],
  ['--source-observed-fg', '--color-surface-soft'],
  ['--source-derived-fg', '--color-bg'],
  ['--source-derived-fg', '--color-surface-soft'],
]

describe('tokens.css', () => {
  it('defines every required role', () => {
    expect(REQUIRED_TOKENS.filter((name) => !vars.has(name))).toEqual([])
  })

  it('ships no dark values while Q-09 is open', () => {
    expect(tokensCss.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/prefers-color-scheme/)
  })

  it.each(CONTRAST_PAIRS)('keeps %s on %s at 4.5:1', (fg, bg) => {
    expect(pairContrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('map token mirror', () => {
  it('matches the alert tier tokens', () => {
    const tiers = [MAP_ALERT_TIERS.alert, MAP_ALERT_TIERS.get_ready, MAP_ALERT_TIERS.red_alert]

    tiers.forEach((style, index) => {
      const tier = index + 1

      expect(style.fill).toBe(vars.get(`--alert-${tier}-bg`))
      expect(style.stroke).toBe(vars.get(`--alert-${tier}-border`))
      expect(style.text).toBe(vars.get(`--alert-${tier}-fg`))
    })
  })

  it('matches the derived source tokens', () => {
    expect(MAP_DERIVED.fill).toBe(vars.get('--source-derived-bg'))
    expect(MAP_DERIVED.stroke).toBe(vars.get('--source-derived-border'))
    expect(String(MAP_DERIVED.fillOpacity)).toBe(vars.get('--source-derived-fill-opacity'))
  })

  it('draws the accuracy ring with the reported source tokens', () => {
    expect(MAP_REPORTED_ACCURACY.fill).toBe(vars.get('--source-observed-bg'))
    expect(MAP_REPORTED_ACCURACY.stroke).toBe(vars.get('--source-observed-border'))
    expect(MAP_REPORTED_ACCURACY.fill).not.toBe(MAP_DERIVED.fill)
  })

  it('matches the terrain ramp tokens', () => {
    MAP_TERRAIN.colors.forEach((color, index) => {
      expect(color).toBe(vars.get(`--terrain-${index + 1}`))
    })

    expect(MAP_TERRAIN.line).toBe(vars.get('--terrain-line'))
    expect(String(MAP_TERRAIN.fillOpacity)).toBe(vars.get('--terrain-fill-opacity'))
  })

  it('orders the terrain ramp from light to dark with one colour per break', () => {
    expect(MAP_TERRAIN.colors.length).toBe(MAP_TERRAIN.breaks.length + 1)

    const lights = MAP_TERRAIN.colors.map((color) => luminance(parseColor(color)))

    expect(lights.every((value, index) => index === 0 || value < lights[index - 1])).toBe(true)
  })

  it('keeps every derived surface colour apart from the alert palette', () => {
    const alertColors = new Set(
      Object.values(MAP_ALERT_TIERS).flatMap((style) => [style.fill, style.stroke, style.text]),
    )
    const derivedColors = new Set([MAP_DERIVED.fill, MAP_DERIVED.stroke, ...MAP_TERRAIN.colors, MAP_TERRAIN.line])

    expect([...derivedColors].filter((value) => alertColors.has(value))).toEqual([])
  })

  it('draws terrain apart from the inundation fill (FR-57)', () => {
    expect(MAP_TERRAIN.colors).not.toContain(MAP_DERIVED.fill)
    expect(MAP_TERRAIN.line).not.toBe(MAP_DERIVED.stroke)
  })

  it('keeps the basemap surfaces apart from the alert tiers', () => {
    const alertFills = new Set(Object.values(MAP_ALERT_TIERS).map((style) => style.fill))
    // Landmarks are decorative point symbols, not surfaces (GIS-01).
    const surfaces = [
      BASEMAP_COLORS.background,
      BASEMAP_COLORS.barangayFill,
      BASEMAP_COLORS.waterFill,
      BASEMAP_COLORS.road,
      BASEMAP_COLORS.boundary,
    ]

    expect(surfaces.filter((value) => alertFills.has(value))).toEqual([])
  })
})

describe('raw hex guard', () => {
  it('keeps every colour inside the token files', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    // A JPEG has no alpha channel; the canvas flattens transparency to white.
    const allowed = new Map([['photo.ts', new Set(['#ffffff'])]])

    const offenders: string[] = []
    let scanned = 0

    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (
        !entry.isFile() ||
        !['.css', '.ts', '.tsx'].includes(extname(entry.name)) ||
        entry.name.includes('.test.')
      ) {
        continue
      }

      const path = relative(root, join(entry.parentPath, entry.name)).replaceAll('\\', '/')

      if (path === 'styles/tokens.css' || path === 'styles/tokens.ts') {
        continue
      }

      const permit = allowed.get(entry.name) ?? new Set<string>()
      const content = readFileSync(join(root, path), 'utf8')

      scanned += 1

      for (const match of content.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        if (!permit.has(match[0].toLowerCase())) {
          offenders.push(`${path}: ${match[0]}`)
        }
      }
    }

    expect(scanned).toBeGreaterThan(50)
    expect(offenders).toEqual([])
  })
})
