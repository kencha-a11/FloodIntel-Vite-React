import type { AccessTagTypeOption } from '../types/accessTag'
import { API_BASE_URL, request } from './http'

/*
 * The taxonomy has exactly one source, the server's enum (FR-112, NFR-42), so
 * the client asks for it and keeps the answer as it received it. It holds no
 * value and no label of its own; adding a taxonomy case stays an enum change
 * plus a requirements edit, never a client release (D-129).
 *
 * The answer is cached on the device rather than in the session: a tag is
 * captured offline (FR-117), so a field account that loaded the list once can
 * still label the step after a reload with no connectivity. The cache is the
 * server's own output, refreshed on every successful online load.
 */

const CACHE_KEY = 'access_tag_types'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function isOption(value: unknown): value is AccessTagTypeOption {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const option = value as Record<string, unknown>

  return (
    typeof option.value === 'string' &&
    option.value !== '' &&
    typeof option.label === 'string' &&
    option.label !== '' &&
    typeof option.requires_note === 'boolean'
  )
}

/** The last published list, or null when this device has never loaded one. */
export function readCachedAccessTagTypes(): AccessTagTypeOption[] | null {
  const raw = storage()?.getItem(CACHE_KEY)

  if (raw === null || raw === undefined) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown

    // A partially readable list would hide a selectable value, so an entry
    // that does not match the published shape invalidates the whole cache.
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isOption)) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function store(options: AccessTagTypeOption[]): void {
  storage()?.setItem(CACHE_KEY, JSON.stringify(options))
}

/** Reads the published vocabulary and refreshes this device's copy (FR-112). */
export async function listAccessTagTypes(
  token: string,
): Promise<AccessTagTypeOption[]> {
  const response = await request<{ data: AccessTagTypeOption[] }>(
    `${API_BASE_URL}/access-tags/types`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  )

  const options = response.data

  if (!Array.isArray(options) || options.length === 0 || !options.every(isOption)) {
    throw new Error('The server did not publish a usable constraint list.')
  }

  store(options)

  return options
}
