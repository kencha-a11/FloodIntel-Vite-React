import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const queueSource = readFileSync(
  fileURLToPath(new URL('./QueueIndicator.tsx', import.meta.url)),
  'utf8',
)

describe('queue disclosure structure (WCAG 1.3.1 and 2.4.6)', () => {
  it('titles the panel at the level its document expects', () => {
    expect(queueSource).toContain('<h2>Offline queue</h2>')
    expect(queueSource).not.toContain('<h3>Offline queue</h3>')
  })

  it('links the toggle to the panel it opens', () => {
    expect(queueSource).toContain('aria-controls="queue-panel"')
    expect(queueSource).toContain('id="queue-panel"')
    expect(queueSource).toContain('aria-expanded={open}')
  })
})
