import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * The three control classes UI-04 had to reach with global stylesheet rules
 * because CameraCapture and PwaUpdatePrompt never joined the primitive set.
 */
const ONE_OFF_CONTROL_CLASSES = ['counter', 'link', 'capture-button']

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('one-off controls', () => {
  it.each(['CameraCapture.tsx', 'PwaUpdatePrompt.tsx'])(
    '%s renders its controls through the Button primitive',
    (file) => {
      const source = read(`./${file}`)

      expect(source).toContain("from './ui'")

      for (const controlClass of ONE_OFF_CONTROL_CLASSES) {
        expect(source, `${file} still uses className="${controlClass}"`).not.toContain(
          `className="${controlClass}"`,
        )
      }
    },
  )

  it('ships the field action as a documented Button size', () => {
    expect(read('./CameraCapture.tsx')).toContain('size="field"')
    expect(read('./ui/Button.tsx')).toContain(`'field'`)
  })

  it('defines no one-off control class in the global stylesheets', () => {
    const sheets: Record<string, string> = {
      'App.css': read('../App.css'),
      'index.css': read('../index.css'),
    }

    for (const [file, css] of Object.entries(sheets)) {
      for (const controlClass of ONE_OFF_CONTROL_CLASSES) {
        expect(css, `${file} still defines .${controlClass}`).not.toContain(
          `.${controlClass} {`,
        )
      }
    }
  })
})
