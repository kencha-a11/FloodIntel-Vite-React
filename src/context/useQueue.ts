import { useContext } from 'react'
import { QueueContext } from './QueueContext'
import type { QueueContextValue } from './QueueContext'

export function useQueue(): QueueContextValue {
  const context = useContext(QueueContext)

  if (context === null) {
    throw new Error('useQueue must be used inside a QueueProvider.')
  }

  return context
}
