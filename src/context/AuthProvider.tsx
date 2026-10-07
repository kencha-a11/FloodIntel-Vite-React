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
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(
    () => authApi.getStoredToken() !== null,
  )
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

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
        }
      })
      .catch(() => {
        if (!cancelled) {
          authApi.storeToken(null)
        }
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
      setUser(response.user)
      return true
    } catch (err) {
      if (err instanceof authApi.AuthApiError) {
        setError(err.message)
        setFieldErrors(err.errors)
      } else {
        setError('Unable to connect to the server.')
      }

      return false
    }
  }, [])

  const register = useCallback(
    async (
      firstName: string,
      lastName: string,
      contactNumber: string,
      email: string,
      password: string,
      passwordConfirmation: string,
    ) => {
      setError(null)
      setFieldErrors({})

      try {
        const response = await authApi.register(
          firstName,
          lastName,
          contactNumber,
          email,
          password,
          passwordConfirmation,
        )
        authApi.storeToken(response.token)
        setUser(response.user)
        return true
      } catch (err) {
        if (err instanceof authApi.AuthApiError) {
          setError(err.message)
          setFieldErrors(err.errors)
        } else {
          setError('Unable to connect to the server.')
        }

        return false
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    const token = authApi.getStoredToken()

    if (token !== null) {
      await authApi.logout(token).catch(() => {})
      authApi.storeToken(null)
    }

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
    } catch {
      authApi.storeToken(null)
      setUser(null)
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
      error,
      fieldErrors,
      login,
      register,
      logout,
      refreshUser,
      resendVerification,
      clearError,
    }),
    [
      user,
      isLoading,
      isEmailVerified,
      error,
      fieldErrors,
      login,
      register,
      logout,
      refreshUser,
      resendVerification,
      clearError,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
