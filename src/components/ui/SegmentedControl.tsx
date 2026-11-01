import type { ReactNode } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string> {
  name: string
  legend: ReactNode
  value: T | ''
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  hint?: ReactNode
  error?: ReactNode
}

export function SegmentedControl<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  hint,
  error,
}: SegmentedControlProps<T>) {
  const hintId = hint === undefined ? undefined : `${name}-hint`
  const errorId = error === undefined ? undefined : `${name}-error`
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <fieldset
      className="ui-segmented"
      aria-invalid={error === undefined ? undefined : true}
      aria-describedby={describedBy}
    >
      <legend className="field-label">{legend}</legend>
      <div className="ui-segmented-options">
        {options.map((option) => (
          <label
            key={option.value}
            className={
              value === option.value
                ? 'ui-segmented-option is-selected'
                : 'ui-segmented-option'
            }
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
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
    </fieldset>
  )
}
