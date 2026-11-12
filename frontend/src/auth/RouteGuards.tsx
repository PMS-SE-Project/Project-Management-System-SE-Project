import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './useAuth'
import { Spinner } from '../components/ui/Spinner'

function AuthLoading() {
  return (
    <div className="standalone-page auth-loading">
      <Spinner label="Checking your session" size="large" />
      <p>Checking your session…</p>
    </div>
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { isCheckingSession, session } = useAuth()

  if (isCheckingSession) return <AuthLoading />
  if (!session) {
    return (
      <Navigate
        replace
        to="/login"
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    )
  }

  return children
}

export function RedirectAuthenticated({ children }: { children: ReactNode }) {
  const { isCheckingSession, session } = useAuth()

  if (isCheckingSession) return <AuthLoading />
  if (session) return <Navigate replace to="/dashboard" />

  return children
}
