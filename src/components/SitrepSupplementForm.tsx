import { useMemo, useState } from 'react'
import { Alert, Button, Field, Select, TextInput, Textarea } from './ui'
import {
  buildPayload,
  isBarangayScoped,
  payloadViolations,
  sectionMeta,
  SITREP_SECTIONS,
} from '../lib/sitrepSections'
import * as sitrepApi from '../lib/sitrepApi'
import type { SitrepSection, SitrepSupplement } from '../types/sitrep'

export interface BarangayOption {
  id: number
  name: string
}

interface SitrepSupplementFormProps {
  token: string
  eventId: number
  barangays: BarangayOption[]
  editing: SitrepSupplement | null
  onSaved: () => void
  onCancel: () => void
}

function initialValues(editing: SitrepSupplement | null): Record<string, string> {
  if (editing === null) {
    return {}
  }

  const values: Record<string, string> = {}

  for (const [key, value] of Object.entries(editing.payload)) {
    values[key] = value === null || value === undefined ? '' : String(value)
  }

  return values
}

/**
 * A mutable supplement draft (D-147). The privacy guard runs before the draft
 * leaves the device: an individual identity in any payload key is refused
 * here, and the server refuses it again (D-45). Once a snapshot is prepared
 * its content is frozen, so edits only shape future revisions.
 */
export function SitrepSupplementForm({
  token,
  eventId,
  barangays,
  editing,
  onSaved,
  onCancel,
}: SitrepSupplementFormProps) {
  const [section, setSection] = useState<SitrepSection>(editing?.section ?? 'weather')
  const [barangayId, setBarangayId] = useState<string>(
    editing?.barangay_id != null ? String(editing.barangay_id) : '',
  )
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(editing))
  const [source, setSource] = useState(editing?.source ?? '')
  const [observedAt, setObservedAt] = useState(editing?.observed_at ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const meta = sectionMeta(section)
  const scoped = isBarangayScoped(section)

  const violations = useMemo(() => payloadViolations(buildPayload(section, values)), [section, values])

  function changeSection(next: SitrepSection): void {
    setSection(next)
    setValues({})
    setError(null)
  }

  function setValue(key: string, value: string): void {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function submit(): Promise<void> {
    setError(null)

    if (scoped && barangayId === '') {
      setError('Choose the barangay this figure belongs to.')
      return
    }

    const payload = buildPayload(section, values)

    if (Object.keys(payload).length === 0) {
      setError('Enter at least one figure before saving the draft.')
      return
    }

    const offending = payloadViolations(payload)

    if (offending.length > 0) {
      setError(
        `This draft carries individual identities (${offending.join(', ')}). ` +
          'The SITREP is aggregate-only — record barangay-level figures, not names, addresses, or photos.',
      )
      return
    }

    setSaving(true)

    try {
      const body = {
        section,
        barangay_id: scoped ? Number(barangayId) : null,
        payload,
        source: source.trim() === '' ? null : source.trim(),
        observed_at: observedAt.trim() === '' ? null : observedAt,
      }

      if (editing === null) {
        await sitrepApi.createSitrepSupplement(token, { event_id: eventId, ...body })
      } else {
        await sitrepApi.updateSitrepSupplement(token, editing.id, body)
      }

      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the draft.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="sitrep-supplement-form"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <h3>{editing === null ? 'Add a supplement draft' : 'Edit supplement draft'}</h3>

      <Field id="sitrep-section" label="Section">
        <Select
          value={section}
          disabled={editing !== null}
          onChange={(event) => changeSection(event.target.value as SitrepSection)}
        >
          {SITREP_SECTIONS.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </Select>
      </Field>

      {scoped && (
        <Field id="sitrep-barangay" label="Barangay">
          <Select value={barangayId} onChange={(event) => setBarangayId(event.target.value)}>
            <option value="">Choose a barangay…</option>
            {barangays.map((barangay) => (
              <option key={barangay.id} value={barangay.id}>
                {barangay.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {meta.fields.map((field) => {
        const id = `sitrep-field-${field.key}`
        const value = values[field.key] ?? ''

        return (
          <Field key={field.key} id={id} label={field.label} hint={field.hint}>
            {field.type === 'textarea' ? (
              <Textarea value={value} rows={3} onChange={(event) => setValue(field.key, event.target.value)} />
            ) : field.type === 'select' ? (
              <Select value={value} onChange={(event) => setValue(field.key, event.target.value)}>
                <option value="">Choose…</option>
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                type={field.type === 'number' ? 'number' : 'text'}
                inputMode={field.type === 'number' ? 'numeric' : undefined}
                min={field.type === 'number' ? 0 : undefined}
                value={value}
                onChange={(event) => setValue(field.key, event.target.value)}
              />
            )}
          </Field>
        )
      })}

      <Field id="sitrep-source" label="Source" hint="Where this figure came from (office, report, or observation).">
        <TextInput value={source} maxLength={500} onChange={(event) => setSource(event.target.value)} />
      </Field>

      <Field id="sitrep-observed" label="Observed at" hint="Optional; the instant the figure was observed.">
        <TextInput type="datetime-local" value={observedAt} onChange={(event) => setObservedAt(event.target.value)} />
      </Field>

      {violations.length > 0 && (
        <Alert tone="warning">
          Aggregate-only: remove individual identities before saving ({violations.join(', ')}).
        </Alert>
      )}

      {error !== null && <Alert tone="danger">{error}</Alert>}

      <div className="sitrep-form-actions">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : editing === null ? 'Save draft' : 'Update draft'}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}