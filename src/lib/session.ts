import type { User } from '../types/auth'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'
const AUTH_AT_KEY = 'auth_at'

export const AUTH_WINDOW_MS = 12 * 60 * 60 * 1000

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

// --- token (single source of the bearer) ---

export function getStoredToken(): string | null {
  return storage()?.getItem(TOKEN_KEY) ?? null
}

export function storeToken(token: string | null): void {
  const store = storage()

  if (token === null) {
    store?.removeItem(TOKEN_KEY)
  } else {
    store?.setItem(TOKEN_KEY, token)
  }
}

export function clearToken(): void {
  storeToken(null)
}

// --- cached user ---

export function cacheUser(user: User): void {
  storage()?.setItem(USER_KEY, JSON.stringify(user))
}

export function readCachedUser(): User | null {
  const raw = storage()?.getItem(USER_KEY)

  if (raw === null || raw === undefined) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { id?: unknown }).id !== 'number' ||
      !Array.isArray((parsed as { abilities?: unknown }).abilities)
    ) {
      return null
    }

    return parsed as User
  } catch {
    return null
  }
}

export function clearCachedUser(): void {
  storage()?.removeItem(USER_KEY)
}

// --- auth instant ---

export function markAuthenticated(at: number = Date.now()): void {
  storage()?.setItem(AUTH_AT_KEY, String(at))
}

export function readLastAuthenticatedAt(): number | null {
  const raw = storage()?.getItem(AUTH_AT_KEY)

  if (raw === null || raw === undefined) {
    return null
  }

  const value = Number.parseInt(raw, 10)

  return Number.isFinite(value) ? value : null
}

export function clearSessionCache(): void {
  const store = storage()

  store?.removeItem(USER_KEY)
  store?.removeItem(AUTH_AT_KEY)
}

// --- expiry (advisory sync window) ---

export function isSyncWindowExpired(
  now: number = Date.now(),
  lastAuthenticatedAt: number | null = readLastAuthenticatedAt(),
): boolean {
  if (lastAuthenticatedAt === null) {
    return false
  }

  return now - lastAuthenticatedAt > AUTH_WINDOW_MS
}

// --- auth-store cleanup: 401 is the expiry authority ---

export function clearAuth(): void {
  storeToken(null)
  clearSessionCache()
}
