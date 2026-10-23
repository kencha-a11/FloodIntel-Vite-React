import { useSyncExternalStore } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { isDraftDirty, subscribeToDraft } from '../lib/draftGuard'

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
      <button
        type="button"
        className="counter"
        disabled={dirty}
        onClick={() => void updateServiceWorker(true)}
      >
        {dirty ? 'Finish report first' : 'Reload'}
      </button>
    </div>
  )
}
