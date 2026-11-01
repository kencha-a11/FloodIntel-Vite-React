import type { SelectHTMLAttributes } from 'react'

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const classes = ['ui-input', className ?? '']
    .filter((value) => value !== '')
    .join(' ')

  return (
    <select className={classes} {...rest}>
      {children}
    </select>
  )
}
