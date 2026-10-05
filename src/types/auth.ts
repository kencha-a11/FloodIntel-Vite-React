export interface User {
  id: number
  first_name: string
  last_name: string
  contact_number: string
  email: string
  email_verified_at: string | null
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  user: User
  token: string
}

export type FieldErrors = Partial<Record<string, string[]>>
