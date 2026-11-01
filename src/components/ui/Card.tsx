import type { ReactNode } from 'react'

export function Card({
  children,
  className,
  label,
}: {
  children: ReactNode
  className?: string
  label?: string
}) {
  const classes = ['ui-card', className ?? ''].filter((value) => value !== '').join(' ')

  return (
    <section className={classes} aria-label={label}>
      {children}
    </section>
  )
}
