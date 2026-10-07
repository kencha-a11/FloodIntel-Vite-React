import { createContext } from 'react'
import type { FieldErrors, User } from '../types/auth'

export interface ResendVerificationResult {
  status: 'sent' | 'already-verified' | 'error'
  message: string
}

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isEmailVerified: boolean
  error: string | null
  fieldErrors: FieldErrors
  login: (identifier: string, password: string) => Promise<boolean>
  register: (
    firstName: string,
    lastName: string,
    contactNumber: string,
    email: string,
    password: string,
    passwordConfirmation: string,
  ) => Promise<boolean>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  resendVerification: () => Promise<ResendVerificationResult>
  clearError: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
