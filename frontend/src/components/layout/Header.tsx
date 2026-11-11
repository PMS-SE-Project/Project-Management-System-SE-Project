import { Link } from 'react-router-dom'

interface HeaderProps {
  isNavigationOpen: boolean
  onMenuClick: () => void
}

export function Header({ isNavigationOpen, onMenuClick }: HeaderProps) {
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
        <Link className="profile-link" to="/login" aria-label="Open account">
          <span className="avatar" aria-hidden="true">·</span>
          <span className="profile-name">Account</span>
        </Link>
        <span className="header-dot" aria-hidden="true" />
      </div>
    </header>
  )
}
