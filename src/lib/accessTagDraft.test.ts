import { describe, expect, it } from 'vitest'
import { EMPTY_TAG_DRAFT, resolveTagDraft } from './accessTagDraft'
import type { TagDraft } from './accessTagDraft'
import type { AccessTagTypeOption } from '../types/accessTag'

/*
 * FR-116 makes the tag step optional and skippable, and FR-112 makes a note
 * mandatory for the case that carries `requires_note`. The resolver is the one
 * place those rules turn into "attempt a tag" or "do not", so the form never
 * blocks a report on a tag field.
 */

const OPTIONS: AccessTagTypeOption[] = [
  { value: 'foot_only', label: 'Foot only', requires_note: false },
  { value: 'unlisted', label: 'Unlisted constraint', requires_note: true },
]

function draft(overrides: Partial<TagDraft>): TagDraft {
  return { ...EMPTY_TAG_DRAFT, ...overrides }
}

describe('resolveTagDraft', () => {
  it('sends nothing while the step is left off', () => {
    expect(resolveTagDraft(EMPTY_TAG_DRAFT, OPTIONS)).toEqual({
      status: 'skipped',
    })
  })

  it('asks for a type when the step is on but nothing is chosen', () => {
    const result = resolveTagDraft(draft({ enabled: true }), OPTIONS)

    expect(result.status).toBe('incomplete')
    expect(result.status === 'incomplete' && result.errors.type).toContain(
      'Choose',
    )
  })

  it('carries the type, landmark, and note when the answer is complete', () => {
    const result = resolveTagDraft(
      draft({
        enabled: true,
        type: 'foot_only',
        landmark: '  Sitio Balite footpath ',
        note: ' Narrow between two walls ',
      }),
      OPTIONS,
    )

    expect(result).toEqual({
      status: 'ready',
      input: {
        type: 'foot_only',
        landmark: 'Sitio Balite footpath',
        note: 'Narrow between two walls',
      },
    })
  })

  it('sends nulls for the fields the reporter left blank', () => {
    const result = resolveTagDraft(
      draft({ enabled: true, type: 'foot_only', landmark: '   ', note: '' }),
      OPTIONS,
    )

    expect(result).toEqual({
      status: 'ready',
      input: { type: 'foot_only', landmark: null, note: null },
    })
  })

  it('requires the note the published option asks for', () => {
    const missing = resolveTagDraft(
      draft({ enabled: true, type: 'unlisted' }),
      OPTIONS,
    )

    expect(missing.status).toBe('incomplete')
    expect(missing.status === 'incomplete' && missing.errors.note).toContain(
      'note',
    )

    expect(
      resolveTagDraft(
        draft({ enabled: true, type: 'unlisted', note: ' Collapsed wall ' }),
        OPTIONS,
      ),
    ).toEqual({
      status: 'ready',
      input: { type: 'unlisted', landmark: null, note: 'Collapsed wall' },
    })
  })

  it('lets the server judge a value this device has not seen', () => {
    expect(
      resolveTagDraft(
        draft({ enabled: true, type: 'retired-case' }),
        OPTIONS,
      ).status,
    ).toBe('ready')
  })
})
