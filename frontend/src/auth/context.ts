import { createContext } from 'react'
import type { LoginRequest, LoginResponse } from '../types/auth'

export interface AuthContextValue {
  session: LoginResponse | null
  isSigningOut: boolean
  signIn: (credentials: LoginRequest) => Promise<LoginResponse>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
