import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sheets: Record<string, string> = {
  'App.css': readFileSync(
    fileURLToPath(new URL('../../App.css', import.meta.url)),
    'utf8',
  ),
  'ui.css': readFileSync(
    fileURLToPath(new URL('./ui.css', import.meta.url)),
    'utf8',
  ),
}

const TARGET_MIN = 44

/* Containers moved focus to programmatically (UI-03, VALID-13); they are not keyboard controls. */
const FOCUSABLE_CONTAINERS = [
  '.auth-shell-main',
  '.app-shell-main',
  '.ui-dialog',
  '.review-workspace-queue',
  '.review-workspace-detail',
]

function blockAfter(css: string, marker: string) {
  const start = css.indexOf(marker)

  expect(start, `stylesheets must still declare ${marker}`).toBeGreaterThan(-1)

  /* Nested rules close at column zero, so the next line-start brace ends the block. */
  const end = css.indexOf('\n}', start)

  return css.slice(start, end === -1 ? css.length : end)
}

describe('target size standard (design §5 and §8)', () => {
  it('keeps every declared minimum control height at 44 px or more', () => {
    const offenders: string[] = []

    for (const [file, css] of Object.entries(sheets)) {
      for (const match of css.matchAll(/min-height:\s*(\d+)px/g)) {
        if (Number(match[1]) < TARGET_MIN) {
          offenders.push(`${file}: min-height: ${match[1]}px`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('sizes the MapLibre zoom and popup controls at the 44 px minimum', () => {
    const block = blockAfter(
      sheets['App.css'],
      '.map-canvas .maplibregl-ctrl button,',
    )

    expect(block).toContain('width: 44px')
    expect(block).toContain('height: 44px')
  })

  it('documents that the compact variant shortens the label, not the hit area', () => {
    expect(blockAfter(sheets['ui.css'], '.ui-button--compact {')).toContain(
      `min-height: ${TARGET_MIN}px`,
    )
  })

  it('gives the primary field action the 48 px minimum (design §8)', () => {
    expect(blockAfter(sheets['ui.css'], '.ui-button--field {')).toContain(
      'min-height: 48px',
    )
  })
})

describe('focus appearance (WCAG 2.2 2.4.7 and 2.4.11)', () => {
  it('never removes the outline from a keyboard-operable control', () => {
    const offenders: string[] = []

    for (const [file, css] of Object.entries(sheets)) {
      const lines = css.split('\n')

      lines.forEach((line, index) => {
        if (!line.includes('outline: none')) {
          return
        }

        const owner = lines
          .slice(Math.max(0, index - 14), index)
          .reverse()
          .find((candidate) => /{?\s*$/.test(candidate) && candidate.includes('.'))

        if (!FOCUSABLE_CONTAINERS.some((name) => owner?.includes(name))) {
          offenders.push(`${file}:${index + 1} ${(owner ?? 'unknown selector').trim()}`)
        }
      })
    }

    expect(offenders).toEqual([])
  })

  it('gives every text control the documented focus ring', () => {
    for (const [file, marker] of [
      ['ui.css', '.ui-input {'],
      ['App.css', '.field input {'],
      ['App.css', '.field select,'],
    ] as const) {
      expect(blockAfter(sheets[file], marker), `${file}: ${marker}`).toContain(
        'outline: var(--focus-ring)',
      )
    }
  })
})
