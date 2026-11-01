import { Alert, Button, Card, Checkbox, Field, SegmentedControl, TextInput, Textarea } from './ui'
import type { TagDraft, TagDraftErrors } from '../lib/accessTagDraft'
import type { TagTypesStatus } from '../lib/useAccessTagTypes'
import type { AccessTagTypeOption } from '../types/accessTag'

/*
 * The optional tag step inside the field capture flow (FR-116). It reuses the
 * report's fix, offers the server's taxonomy as labelled text (NFR-42, NFR-43),
 * and is skippable: nothing here is required for the report to be sent.
 *
 * The options and their `requires_note` rule arrive as props, so this component
 * knows no taxonomy value of its own and a new case needs no client release.
 */

export interface AccessTagStepProps {
  draft: TagDraft
  onChange: (draft: TagDraft) => void
  options: AccessTagTypeOption[]
  status: TagTypesStatus
  onReload: () => void
  errors: TagDraftErrors
  /** The report's fix, already formatted, so the step shows one location. */
  location: string
}

export function AccessTagStep({
  draft,
  onChange,
  options,
  status,
  onReload,
  errors,
  location,
}: AccessTagStepProps) {
  const requiresNote =
    options.find((option) => option.value === draft.type)?.requires_note === true

  return (
    <Card className="access-tag-step">
      <h3>Access tag (optional)</h3>
      <p className="muted">
        Record a place a response team cannot pass, or can pass only on foot.
        It uses the location already captured for this report.
      </p>

      {status === 'unavailable' ? (
        <Alert tone="warning">
          The constraint types are not available on this device yet. Connect
          once to load them; this never holds up your report.{' '}
          <Button variant="quiet" onClick={onReload}>
            Try again
          </Button>
        </Alert>
      ) : status === 'loading' ? (
        <p className="muted">Loading constraint types…</p>
      ) : (
        <>
          <Checkbox
            id="tag-enabled"
            checked={draft.enabled}
            label="Record an access tag here"
            hint="Skip this if the route is passable by vehicle."
            onChange={(enabled) => onChange({ ...draft, enabled })}
          />

          {draft.enabled && (
            <>
              <SegmentedControl
                name="tag-type"
                legend="Constraint type"
                value={draft.type}
                options={options.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                onChange={(type) => onChange({ ...draft, type })}
                error={errors.type}
                hint="Choose what stops a vehicle or a boat reaching this place."
              />

              <Field
                id="tag-landmark"
                label="Landmark (optional)"
                hint="A place name a team will recognise."
              >
                <TextInput
                  type="text"
                  maxLength={255}
                  value={draft.landmark}
                  onChange={(event) =>
                    onChange({ ...draft, landmark: event.target.value })
                  }
                />
              </Field>

              <Field
                id="tag-note"
                label={requiresNote ? 'Note (required)' : 'Note (optional)'}
                error={errors.note}
              >
                <Textarea
                  value={draft.note}
                  maxLength={1000}
                  rows={2}
                  onChange={(event) =>
                    onChange({ ...draft, note: event.target.value })
                  }
                />
              </Field>

              <p className="muted">
                Location: {location} · the same fix as this report.
              </p>
            </>
          )}
        </>
      )}
    </Card>
  )
}
