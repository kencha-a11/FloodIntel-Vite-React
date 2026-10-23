import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type {
  FieldErrors,
  User,
} from '../types/auth'
import type { ResendVerificationResult } from './AuthContext'
import * as authApi from '../lib/authApi'
import {
  cacheUser,
  clearSessionCache,
  markAuthenticated,
  readCachedUser,
} from '../lib/session'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() =>
    authApi.getStoredToken() !== null ? readCachedUser() : null,
  )
  const [isLoading, setIsLoading] = useState(() => {
    if (authApi.getStoredToken() === null) {
      return false
    }

    return readCachedUser() === null
  })
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [lockoutSeconds, setLockoutSeconds] = useState(0)

  useEffect(() => {
    if (lockoutSeconds <= 0) {
      return
    }

    const timer = setTimeout(() => {
      setLockoutSeconds((seconds) => seconds - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [lockoutSeconds])

  useEffect(() => {
    const token = authApi.getStoredToken()

    if (token === null) {
      return
    }

    let cancelled = false

    authApi
      .fetchUser(token)
      .then((fetchedUser) => {
        if (!cancelled) {
          setUser(fetchedUser)
          cacheUser(fetchedUser)
          markAuthenticated()
        }
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return
        }

        if (
          err instanceof authApi.AuthApiError &&
          (err.status === 401 || err.status === 403)
        ) {
          authApi.storeToken(null)
          clearSessionCache()
          setUser(null)

          return
        }

        setUser(readCachedUser())
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (identifier: string, password: string) => {
    setError(null)
    setFieldErrors({})

    try {
      const response = await authApi.login(identifier, password)
      authApi.storeToken(response.token)
      cacheUser(response.user)
      markAuthenticated()
      setUser(response.user)
      setLockoutSeconds(0)
      return true
    } catch (err) {
      if (err instanceof authApi.AuthApiError) {
        setError(err.message)
        setFieldErrors(err.errors)

        if (err.status === 429) {
          setLockoutSeconds(err.retryAfter ?? 60)
        }
      } else {
        setError('Unable to connect to the server.')
      }

      return false
    }
  }, [])

  const logout = useCallback(async () => {
    const token = authApi.getStoredToken()

    if (token !== null) {
      await authApi.logout(token).catch(() => {})
      authApi.storeToken(null)
    }

    clearSessionCache()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const token = authApi.getStoredToken()

    if (token === null) {
      return
    }

    try {
      const fetchedUser = await authApi.fetchUser(token)
      setUser(fetchedUser)
      cacheUser(fetchedUser)
      markAuthenticated()
    } catch (err) {
      if (
        err instanceof authApi.AuthApiError &&
        (err.status === 401 || err.status === 403)
      ) {
        authApi.storeToken(null)
        clearSessionCache()
        setUser(null)
      }
    }
  }, [])

  const resendVerification = useCallback(async (): Promise<ResendVerificationResult> => {
    const token = authApi.getStoredToken()

    if (token === null) {
      return { status: 'error', message: 'You are not signed in.' }
    }

    try {
      const response = await authApi.resendVerification(token)
      return { status: 'sent', message: response.message }
    } catch (err) {
      if (err instanceof authApi.AuthApiError) {
        if (err.status === 409) {
          return { status: 'already-verified', message: err.message }
        }

        return { status: 'error', message: err.message }
      }

      return { status: 'error', message: 'Unable to connect to the server.' }
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
    setFieldErrors({})
  }, [])

  const isEmailVerified = user !== null && user.email_verified_at !== null

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isEmailVerified,
      lockoutSeconds,
      error,
      fieldErrors,
      login,
      logout,
      refreshUser,
      resendVerification,
      clearError,
    }),
    [
      user,
      isLoading,
      isEmailVerified,
      lockoutSeconds,
      error,
      fieldErrors,
      login,
      logout,
      refreshUser,
      resendVerification,
      clearError,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
