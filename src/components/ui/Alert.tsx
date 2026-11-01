import type { ReactNode } from 'react'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

export interface AlertProps {
  tone?: AlertTone
  children: ReactNode
  className?: string
  role?: 'alert' | 'status'
}

export function Alert({ tone = 'info', children, className, role }: AlertProps) {
  const classes = ['ui-alert', `ui-alert--${tone}`, className ?? '']
    .filter((value) => value !== '')
    .join(' ')

  return (
    <p className={classes} role={role ?? (tone === 'danger' ? 'alert' : 'status')}>
      {children}
    </p>
  )
}
