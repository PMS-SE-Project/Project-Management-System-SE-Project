import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { login, logout } from '../api/auth'
import type { LoginRequest, LoginResponse } from '../types/auth'
import { AuthContext } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LoginResponse | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const signIn = useCallback(async (credentials: LoginRequest) => {
    const response = await login(credentials)
    setSession(response)
    return response
  }, [])

  const signOut = useCallback(async () => {
    if (!session) return

    setIsSigningOut(true)
    try {
      await logout(session.session_id)
      setSession(null)
    } finally {
      setIsSigningOut(false)
    }
  }, [session])

  const value = useMemo(
    () => ({ session, isSigningOut, signIn, signOut }),
    [isSigningOut, session, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
