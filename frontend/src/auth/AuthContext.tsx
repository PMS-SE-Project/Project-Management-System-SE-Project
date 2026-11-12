import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getCurrentUser, login, logout } from '../api/auth'
import { ApiError, setUnauthorizedHandler } from '../api/client'
import type { LoginRequest, LoginResponse } from '../types/auth'
import { AuthContext } from './context'

const SESSION_STORAGE_KEY = 'projecthub.session'

function readStoredSessionId(): string | null {
  const storedSession = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!storedSession) return null

  try {
    const parsed: unknown = JSON.parse(storedSession)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'session_id' in parsed &&
      typeof parsed.session_id === 'string' &&
      parsed.session_id.length > 0
    ) {
      return parsed.session_id
    }
  } catch {
    clearStoredSession()
    return null
  }

  clearStoredSession()
  return null
}

function storeSession(session: LoginResponse) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

function clearStoredSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LoginResponse | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(
    () => readStoredSessionId() !== null,
  )
  const [sessionValidationError, setSessionValidationError] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    setUnauthorizedHandler((sessionId) => {
      setSession((currentSession) => {
        if (currentSession?.session_id !== sessionId) return currentSession
        clearStoredSession()
        return null
      })
    })

    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const storedSessionId = readStoredSessionId()

    if (!storedSessionId) {
      return () => controller.abort()
    }

    getCurrentUser(storedSessionId, controller.signal)
      .then((user) => {
        const restoredSession: LoginResponse = {
          message: 'Session restored',
          session_id: storedSessionId,
          user,
        }
        setSession(restoredSession)
        storeSession(restoredSession)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return

        if (error instanceof ApiError && error.status === 401) {
          clearStoredSession()
          setSession(null)
          return
        }

        setSessionValidationError(
          'We could not verify your saved session. Check your connection and sign in again.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsCheckingSession(false)
      })

    return () => controller.abort()
  }, [])

  const signIn = useCallback(async (credentials: LoginRequest) => {
    const response = await login(credentials)
    setSession(response)
    setSessionValidationError(null)
    storeSession(response)
    return response
  }, [])

  const signOut = useCallback(async () => {
    if (!session) return

    setIsSigningOut(true)
    try {
      await logout(session.session_id)
      setSession(null)
      clearStoredSession()
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
        setSession(null)
        clearStoredSession()
        return
      }
      throw error
    } finally {
      setIsSigningOut(false)
    }
  }, [session])

  const value = useMemo(
    () => ({
      session,
      isCheckingSession,
      sessionValidationError,
      isSigningOut,
      signIn,
      signOut,
    }),
    [isCheckingSession, isSigningOut, session, sessionValidationError, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
