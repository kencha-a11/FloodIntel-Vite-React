import { useEffect, useState } from 'react'

/**
 * A tab the browser is not painting. `undefined` is the no-DOM case (the client
 * test environment runs in Node), where nothing is hidden.
 */
export function isPageVisible(visibilityState: string | undefined): boolean {
  return visibilityState !== 'hidden'
}

export function readVisibilityState(): string | undefined {
  return typeof document === 'undefined' ? undefined : document.visibilityState
}

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() =>
    isPageVisible(readVisibilityState()),
  )

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const handleChange = () => {
      setVisible(isPageVisible(readVisibilityState()))
    }

    document.addEventListener('visibilitychange', handleChange)

    return () => {
      document.removeEventListener('visibilitychange', handleChange)
    }
  }, [])

  return visible
}
