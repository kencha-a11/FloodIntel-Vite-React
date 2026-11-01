import type { ReactNode } from 'react'

export type BadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'alert-1'
  | 'alert-2'
  | 'alert-3'

export type Severity = 1 | 2 | 3 | 4 | 5

export interface BadgeProps {
  tone?: BadgeTone
  severity?: Severity
  children: ReactNode
  className?: string
}

export function Badge({ tone = 'neutral', severity, children, className }: BadgeProps) {
  const classes =
    severity === undefined
      ? ['ui-badge', `ui-badge--${tone}`, className ?? '']
      : ['severity-badge', `severity-${severity}`, className ?? '']

  return <span className={classes.filter((value) => value !== '').join(' ')}>{children}</span>
}
