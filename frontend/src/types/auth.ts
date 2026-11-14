import type { UserRole } from './user'

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthenticatedUser {
  email: string
  role: UserRole
}

export interface LoginResponse {
  message: string
  session_id: string
  user: AuthenticatedUser
}

export type CurrentUserResponse = AuthenticatedUser
