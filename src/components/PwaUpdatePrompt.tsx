import { useSyncExternalStore } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { isDraftDirty, subscribeToDraft } from '../lib/draftGuard'
import { Button } from './ui'

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const dirty = useSyncExternalStore(subscribeToDraft, isDraftDirty)

  if (!needRefresh) {
    return null
  }

  return (
    <div className="pwa-update" role="status">
      <span>
        A new version of FloodIntel is available.
        {dirty ? ' Finish this report before reloading.' : ''}
      </span>
      <Button variant="secondary" disabled={dirty} onClick={() => void updateServiceWorker(true)}>
        {dirty ? 'Finish report first' : 'Reload'}
      </Button>
    </div>
  )
}
