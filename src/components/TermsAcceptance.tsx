import { useState } from 'react'
import { Card, Checkbox } from './ui'
import {
  TERMS_SECTIONS,
  TERMS_TITLE,
  clearTermsAcceptance,
  hasAcceptedTerms,
  markTermsAccepted,
} from '../lib/terms'

export interface TermsAcceptanceProps {
  accepted?: boolean
  checked?: boolean
  value?: boolean
  defaultAccepted?: boolean
  defaultChecked?: boolean
  onAcceptedChange?: (accepted: boolean) => void
  onChange?: (accepted: boolean) => void
  onAcceptanceChange?: (accepted: boolean) => void
  id?: string
}

export function TermsAcceptance({
  accepted,
  checked,
  value,
  defaultAccepted,
  defaultChecked,
  onAcceptedChange,
  onChange,
  onAcceptanceChange,
  id = 'terms-accepted',
}: TermsAcceptanceProps) {
  const controlled =
    accepted !== undefined
      ? accepted
      : checked !== undefined
        ? checked
        : value

  const [internal, setInternal] = useState<boolean>(
    defaultAccepted ??
      defaultChecked ??
      controlled ??
      hasAcceptedTerms(),
  )

  const resolved = controlled === undefined ? internal : controlled

  function handleChange(next: boolean): void {
    if (controlled === undefined) {
      setInternal(next)
    }

    if (next) {
      markTermsAccepted()
    } else {
      clearTermsAcceptance()
    }

    onAcceptedChange?.(next)
    onChange?.(next)
    onAcceptanceChange?.(next)
  }

  return (
    <Card label={TERMS_TITLE}>
      <h3>{TERMS_TITLE}</h3>
      {TERMS_SECTIONS.map((section) => (
        <section key={section.heading}>
          <h4>{section.heading}</h4>
          <p>{section.body}</p>
        </section>
      ))}
      <Checkbox
        id={id}
        checked={resolved}
        onChange={handleChange}
        label="I have read and accept the terms and conditions."
      />
    </Card>
  )
}

export default TermsAcceptance
