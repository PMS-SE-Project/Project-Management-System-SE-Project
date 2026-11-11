import { Link } from 'react-router-dom'

export function Header() {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Workspace</p>
        <h1>Project Management System</h1>
      </div>
      <Link className="profile-link" to="/login" aria-label="Open account">
        <span className="avatar">S</span>
        <span className="profile-name">Sowmya Ramesh</span>
      </Link>
    </header>
  )
}
