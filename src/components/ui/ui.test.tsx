import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  SegmentedControl,
  Select,
  Spinner,
  Textarea,
  TextInput,
} from './index'

function render(element: ReactElement): string {
  return renderToStaticMarkup(element)
}

describe('Button', () => {
  it('defaults to type=button so forms never submit by accident', () => {
    expect(render(<Button>Save</Button>)).toContain('type="button"')
  })

  it('applies the variant and size classes', () => {
    const html = render(
      <Button variant="danger" size="compact">
        Reject
      </Button>,
    )

    expect(html).toContain('ui-button--danger')
    expect(html).toContain('ui-button--compact')
  })

  it('carries the field size only when asked', () => {
    expect(render(<Button size="md">Save</Button>)).not.toContain('ui-button--md')
    expect(render(<Button size="field">Capture</Button>)).toContain('ui-button--field')
  })

  it('keeps type=submit when asked and passes the className through', () => {
    const html = render(
      <Button type="submit" className="extra">
        Send
      </Button>,
    )

    expect(html).toContain('type="submit"')
    expect(html).toContain('extra')
  })
})

describe('Field', () => {
  it('binds the label and control by id', () => {
    const html = render(
      <Field id="notes" label="Notes">
        <TextInput value="" onChange={() => {}} />
      </Field>,
    )

    expect(html).toContain('for="notes"')
    expect(html).toContain('id="notes"')
  })

  it('marks the control invalid and describes it with hint and error', () => {
    const html = render(
      <Field id="depth" label="Depth" hint="Centimetres" error="Required">
        <TextInput value="" onChange={() => {}} />
      </Field>,
    )

    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="depth-hint depth-error"')
    expect(html).toContain('id="depth-hint"')
    expect(html).toContain('id="depth-error"')
  })

  it('omits the invalid state when there is no error', () => {
    const html = render(
      <Field id="name" label="Name">
        <TextInput value="" onChange={() => {}} />
      </Field>,
    )

    expect(html).not.toContain('aria-invalid')
  })
})

describe('form controls', () => {
  it('renders native controls with the shared input class', () => {
    expect(render(<TextInput value="" onChange={() => {}} />)).toContain(
      'ui-input',
    )
    expect(
      render(
        <Select value="" onChange={() => {}}>
          <option value="">All</option>
        </Select>,
      ),
    ).toContain('ui-input')
    expect(
      render(<Textarea value="" onChange={() => {}} />),
    ).toContain('ui-input')
  })
})

describe('SegmentedControl', () => {
  const options = [
    { value: 'low' as const, label: 'Low' },
    { value: 'high' as const, label: 'High' },
  ]

  it('marks the active option and names the radio group', () => {
    const html = render(
      <SegmentedControl
        name="level"
        legend="Level"
        value="high"
        options={options}
        onChange={() => {}}
      />,
    )

    expect(html).toContain('<legend class="field-label">Level</legend>')
    expect(html).toContain('name="level"')
    expect(html).toContain('is-selected')
    expect(html).toContain('checked=""')
  })

  it('reports invalid state and describes the group on error', () => {
    const html = render(
      <SegmentedControl
        name="level"
        legend="Level"
        value=""
        options={options}
        onChange={() => {}}
        error="Choose a level"
      />,
    )

    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="level-error"')
    expect(html).toContain('id="level-error"')
  })
})

describe('Checkbox', () => {
  it('binds the label to the input and reflects the checked state', () => {
    const html = render(
      <Checkbox
        id="tag-enabled"
        checked
        onChange={() => {}}
        label="Record an access tag"
      />,
    )

    expect(html).toContain('for="tag-enabled"')
    expect(html).toContain('id="tag-enabled"')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked=""')
    expect(html).toContain('Record an access tag')
  })

  it('leaves a cleared box unchecked and undescribed', () => {
    const html = render(
      <Checkbox
        id="tag-enabled"
        checked={false}
        onChange={() => {}}
        label="Record an access tag"
      />,
    )

    expect(html).not.toContain('checked')
    expect(html).not.toContain('aria-invalid')
    expect(html).not.toContain('aria-describedby')
  })

  it('marks the input invalid and describes it with hint and error', () => {
    const html = render(
      <Checkbox
        id="consent"
        checked={false}
        onChange={() => {}}
        label="I agree"
        hint="Read once"
        error="Required"
      />,
    )

    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="consent-hint consent-error"')
    expect(html).toContain('id="consent-hint"')
    expect(html).toContain('id="consent-error"')
  })
})

describe('Badge', () => {
  it('renders the legacy severity palette when a severity is given', () => {
    const html = render(<Badge severity={2}>Knee-deep</Badge>)

    expect(html).toContain('severity-badge severity-2')
  })

  it('renders a status tone otherwise and defaults to neutral', () => {
    expect(render(<Badge tone="danger">Rejected</Badge>)).toContain(
      'ui-badge--danger',
    )
    expect(render(<Badge>Submitted</Badge>)).toContain('ui-badge--neutral')
  })
})

describe('Alert', () => {
  it('announces danger as an alert and everything else as status', () => {
    expect(render(<Alert tone="danger">Failed</Alert>)).toContain(
      'role="alert"',
    )
    expect(render(<Alert tone="success">Saved</Alert>)).toContain(
      'role="status"',
    )
  })

  it('honours an explicit role', () => {
    expect(
      render(
        <Alert tone="info" role="alert">
          Check this
        </Alert>,
      ),
    ).toContain('role="alert"')
  })

  it('carries an id so a field can describe itself with it', () => {
    expect(render(<Alert tone="danger" id="photo-error">Failed</Alert>)).toContain(
      'id="photo-error"',
    )
  })
})

describe('layout primitives', () => {
  it('renders Card as a labelled section', () => {
    const html = render(<Card label="Flags">Content</Card>)

    expect(html).toContain('<section')
    expect(html).toContain('aria-label="Flags"')
  })

  it('renders an empty state with an optional action', () => {
    const html = render(
      <EmptyState title="Nothing here." action={<Button>Retry</Button>} />,
    )

    expect(html).toContain('ui-empty-title')
    expect(html).toContain('Nothing here.')
    expect(html).toContain('Retry')
  })

  it('renders a polite spinner with the ring hidden from assistive tech', () => {
    const html = render(<Spinner />)

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('Loading…')
  })
})
