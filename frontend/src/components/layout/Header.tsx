import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'

interface HeaderProps {
  isNavigationOpen: boolean
  onMenuClick: () => void
}

export function Header({ isNavigationOpen, onMenuClick }: HeaderProps) {
  const navigate = useNavigate()
  const { session, isSigningOut, signOut } = useAuth()
  const [logoutError, setLogoutError] = useState(false)

  async function handleSignOut() {
    setLogoutError(false)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      setLogoutError(true)
    }
  }

  return (
    <header className="app-header">
      <button
        className="menu-toggle"
        type="button"
        onClick={onMenuClick}
        aria-label={isNavigationOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={isNavigationOpen}
        aria-controls="primary-navigation"
      >
        <span />
        <span />
        <span />
      </button>
      <div className="header-context">
        <span className="breadcrumb-pill">Workspace</span>
        <span className="breadcrumb-separator" aria-hidden="true">/</span>
        <span className="breadcrumb-current">Overview</span>
      </div>
      <div className="header-actions">
        <span className="header-note">ProjectHub workspace</span>
        {session && (
          <div className="account-summary">
            <span className="avatar" aria-hidden="true">
              {session.user.email.charAt(0).toUpperCase()}
            </span>
            <span className="profile-name">
              <strong>{session.user.email}</strong>
              <small>{session.user.role.replace('_', ' ')}</small>
            </span>
          </div>
        )}
        {session && (
          <button
            className="logout-button"
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? 'Signing out' : 'Log out'}
          </button>
        )}
        <span className="header-dot" aria-hidden="true" />
        {logoutError && <span className="header-auth-error" role="alert">Logout failed</span>}
      </div>
    </header>
  )
}
