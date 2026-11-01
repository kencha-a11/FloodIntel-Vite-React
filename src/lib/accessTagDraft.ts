import type { AccessTagTypeOption } from '../types/accessTag'

/** What the optional tag step holds before the report's fix is attached. */
export interface TagDraft {
  enabled: boolean
  type: string
  landmark: string
  note: string
}

export const EMPTY_TAG_DRAFT: TagDraft = {
  enabled: false,
  type: '',
  landmark: '',
  note: '',
}

export interface TagDraftErrors {
  type?: string
  note?: string
}

export type TagDraftResolution =
  | { status: 'skipped' }
  | { status: 'incomplete'; errors: TagDraftErrors }
  | {
      status: 'ready'
      input: { type: string; note: string | null; landmark: string | null }
    }

/**
 * Reads the optional step as one of three answers: nothing to send, not enough
 * to send, or the three fields a tag adds to the report's fix.
 *
 * The note rule comes from the published option rather than a value the client
 * knows (FR-112, NFR-42), so the step applies the server's taxonomy without
 * naming any of its cases. An incomplete answer never blocks the report
 * (FR-116); it only decides whether a tag is attempted at all.
 */
export function resolveTagDraft(
  draft: TagDraft,
  options: AccessTagTypeOption[],
): TagDraftResolution {
  if (!draft.enabled) {
    return { status: 'skipped' }
  }

  if (draft.type === '') {
    return {
      status: 'incomplete',
      errors: { type: 'Choose the constraint that stops a team here.' },
    }
  }

  const requiresNote =
    options.find((option) => option.value === draft.type)?.requires_note === true

  if (requiresNote && draft.note.trim() === '') {
    return {
      status: 'incomplete',
      errors: { note: 'A note is required for this type.' },
    }
  }

  return {
    status: 'ready',
    input: {
      type: draft.type,
      note: blankToNull(draft.note),
      landmark: blankToNull(draft.landmark),
    },
  }
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}
