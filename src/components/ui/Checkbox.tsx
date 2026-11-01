import type { ReactNode } from 'react'

export interface CheckboxProps {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
}

export function Checkbox({
  id,
  checked,
  onChange,
  label,
  hint,
  error,
}: CheckboxProps) {
  const hintId = hint === undefined ? undefined : `${id}-hint`
  const errorId = error === undefined ? undefined : `${id}-error`
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="ui-checkbox">
      <label className="ui-checkbox-label" htmlFor={id}>
        <input
          id={id}
          className="ui-checkbox-input"
          type="checkbox"
          checked={checked}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{label}</span>
      </label>
      {hint !== undefined && (
        <small id={hintId} className="field-hint">
          {hint}
        </small>
      )}
      {error !== undefined && (
        <small id={errorId} className="field-error">
          {error}
        </small>
      )}
    </div>
  )
}
