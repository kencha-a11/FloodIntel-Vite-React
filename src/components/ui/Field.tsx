import { cloneElement, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'

interface FieldControlProps {
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

export interface FieldProps {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactElement<FieldControlProps>
  className?: string
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: FieldProps) {
  const hintId = hint === undefined ? undefined : `${id}-hint`
  const errorId = error === undefined ? undefined : `${id}-error`
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error === undefined ? undefined : true,
        'aria-describedby': describedBy,
      })
    : children

  const classes = ['field', className ?? ''].filter((value) => value !== '').join(' ')

  return (
    <div className={classes}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {control}
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
