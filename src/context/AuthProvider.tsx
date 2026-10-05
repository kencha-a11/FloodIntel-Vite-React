import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { FieldErrors, User } from '../types/auth'
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

  const clearError = useCallback(() => {
    setError(null)
    setFieldErrors({})
  }, [])

  const value = useMemo(
    () => ({
      user,
      isLoading,
      error,
      fieldErrors,
      login,
      register,
      logout,
      clearError,
    }),
    [user, isLoading, error, fieldErrors, login, register, logout, clearError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
