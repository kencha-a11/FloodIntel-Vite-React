import type { ReactNode } from 'react'

export interface EmptyStateProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="ui-empty">
      <p className="ui-empty-title">{title}</p>
      {description !== undefined && <p className="muted">{description}</p>}
      {action !== undefined && <div className="ui-empty-action">{action}</div>}
    </div>
  )
}
