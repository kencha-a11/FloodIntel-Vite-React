import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const queueSource = readFileSync(
  fileURLToPath(new URL('./QueueIndicator.tsx', import.meta.url)),
  'utf8',
)

describe('queue disclosure structure (WCAG 1.3.1 and 2.4.6)', () => {
  it('titles the panel at the level its document expects', () => {
    expect(queueSource).toContain('<h2 id="queue-panel-title">Offline queue</h2>')
    expect(queueSource).not.toContain('<h3>Offline queue</h3>')
  })

  it('names the panel heading as the panel label', () => {
    expect(queueSource).toContain('aria-labelledby="queue-panel-title"')
  })

  it('links the toggle to the panel it opens', () => {
    expect(queueSource).toContain('aria-controls="queue-panel"')
    expect(queueSource).toContain('id="queue-panel"')
    expect(queueSource).toContain('aria-expanded={open}')
  })
})

describe('queue panel fit at 320 px (design §14)', () => {
  /*
   * The panel is anchored to a trigger that sits left of the log-out action,
   * so a measured 320 px viewport put its left edge 60 px off-screen. The
   * narrow rule docks it to the viewport instead of the trigger.
   */
  it('docks the panel to the viewport below 480 px', () => {
    const css = readFileSync(
      fileURLToPath(new URL('../App.css', import.meta.url)),
      'utf8',
    )
    const start = css.indexOf('@media (max-width: 480px)')
    const block = css.slice(start, css.indexOf('\n}', start))

    expect(start).toBeGreaterThan(-1)
    expect(block).toContain('.queue-panel')
    expect(block).toContain('position: fixed')
    expect(block).toContain('left: var(--space-3)')
    expect(block).toContain('right: var(--space-3)')
    expect(block).toContain('width: auto')
  })
})
