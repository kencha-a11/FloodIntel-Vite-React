const listeners = new Set<() => void>()

let dirty = false

export function isDraftDirty(): boolean {
  return dirty
}

export function setDraftDirty(next: boolean): void {
  if (dirty === next) {
    return
  }

  dirty = next

  for (const listener of listeners) {
    listener()
  }
}

export function subscribeToDraft(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
