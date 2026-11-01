import type { TextareaHTMLAttributes } from 'react'

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const classes = ['ui-input', className ?? '']
    .filter((value) => value !== '')
    .join(' ')

  return <textarea className={classes} {...rest} />
}
