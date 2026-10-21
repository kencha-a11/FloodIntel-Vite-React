export type UserRole =
  | 'mdrrmo_officer'
  | 'mdrrmo_staff'
  | 'barangay_captain'
  | 'barangay_tanod'
  | 'rescue_leader'

export type AccessInterface = 'command_center' | 'field_reporter'

export interface UserBarangay {
  id: number
  name: string
  code: string
  is_active: boolean
}

export interface User {
  id: number
  first_name: string
  last_name: string
  contact_number: string
  email: string
  email_verified_at: string | null
  created_at: string
  updated_at: string
  role: UserRole
  role_label: string
  interface: AccessInterface
  abilities: string[]
  barangay: UserBarangay | null
}

export interface AuthResponse {
  user: User
  token: string
}

export interface ApiToken {
  id: number
  name: string
  abilities: string[]
  created_at: string
  last_used_at: string | null
}

export interface CreateTokenResponse {
  data: ApiToken
  token: string
}

export type FieldErrors = Partial<Record<string, string[]>>
