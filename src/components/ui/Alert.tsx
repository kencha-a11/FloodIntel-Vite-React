import type { ReactNode } from 'react'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

export interface AlertProps {
  tone?: AlertTone
  children: ReactNode
  className?: string
  role?: 'alert' | 'status'
  id?: string
}

export function Alert({ tone = 'info', children, className, role, id }: AlertProps) {
  const classes = ['ui-alert', `ui-alert--${tone}`, className ?? '']
    .filter((value) => value !== '')
    .join(' ')

  return (
    <p
      id={id}
      className={classes}
      role={role ?? (tone === 'danger' ? 'alert' : 'status')}
    >
      {children}
    </p>
  )
}
