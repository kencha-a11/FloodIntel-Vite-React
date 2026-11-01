import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AccessTagStep } from './AccessTagStep'
import type { AccessTagStepProps } from './AccessTagStep'
import type { TagDraft } from '../lib/accessTagDraft'

const OPTIONS = [
  { value: 'no_vehicle_access', label: 'No vehicle access', requires_note: false },
  { value: 'other', label: 'Other constraint', requires_note: true },
]

function render(overrides: Partial<AccessTagStepProps> = {}): string {
  const draft: TagDraft = {
    enabled: false,
    type: '',
    landmark: '',
    note: '',
  }

  return renderToStaticMarkup(
    <AccessTagStep
      draft={draft}
      onChange={() => {}}
      options={OPTIONS}
      status="ready"
      onReload={() => {}}
      errors={{}}
      location="14.951234° N, 120.760123° E"
      {...overrides}
    />,
  )
}

describe('AccessTagStep', () => {
  it('keeps the taxonomy collapsed behind the skippable toggle', () => {
    const html = render()

    expect(html).toContain('Access tag (optional)')
    expect(html).toContain('Record an access tag here')
    expect(html).not.toContain('Constraint type')
    expect(html).not.toContain('No vehicle access')
  })

  it('offers the published labels as text once the toggle is on', () => {
    const html = render({
      draft: { enabled: true, type: '', landmark: '', note: '' },
    })

    expect(html).toContain('Constraint type')
    expect(html).toContain('No vehicle access')
    expect(html).toContain('Other constraint')
    // The value travels as the control's value; the reporter only reads labels.
    expect(html).toContain('value="no_vehicle_access"')
    expect(html).toContain('type="radio"')
  })

  it('requires the note only for the types the server marks', () => {
    expect(
      render({ draft: { enabled: true, type: 'other', landmark: '', note: '' } }),
    ).toContain('Note (required)')

    expect(
      render({
        draft: { enabled: true, type: 'no_vehicle_access', landmark: '', note: '' },
      }),
    ).toContain('Note (optional)')
  })

  it('shows the report fix rather than asking for a second one', () => {
    const html = render({
      draft: { enabled: true, type: 'no_vehicle_access', landmark: '', note: '' },
    })

    expect(html).toContain('Location: 14.951234° N, 120.760123° E')
    expect(html).toContain('the same fix as this report')
    expect(html).not.toContain('type="file"')
  })

  it('states that an unloaded taxonomy never holds up the report', () => {
    const html = render({ status: 'unavailable' })

    expect(html).toContain('never holds up your report')
    expect(html).toContain('Try again')
  })

  it('announces the load in progress instead of an empty control', () => {
    const html = render({ status: 'loading' })

    expect(html).toContain('Loading constraint types')
    expect(html).not.toContain('Record an access tag here')
  })

  it('renders the resolver errors against the controls they describe', () => {
    const html = render({
      draft: { enabled: true, type: '', landmark: '', note: '' },
      errors: {
        type: 'Choose the constraint that stops a team here.',
        note: 'A note is required for this type.',
      },
    })

    expect(html).toContain('Choose the constraint that stops a team here.')
    expect(html).toContain('A note is required for this type.')
    expect(html).toContain('aria-invalid="true"')
  })
})
