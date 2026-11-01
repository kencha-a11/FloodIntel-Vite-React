import type { InputHTMLAttributes } from 'react'

export function TextInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  const classes = ['ui-input', className ?? '']
    .filter((value) => value !== '')
    .join(' ')

  return <input className={classes} {...rest} />
}
