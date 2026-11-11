import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="standalone-page">
      <div className="login-card">
        <p className="eyebrow">404 error</p>
        <h1>Page not found</h1>
        <p className="page-description">The page you requested does not exist.</p>
        <Link className="primary-button" to="/dashboard">Return to dashboard</Link>
      </div>
    </div>
  )
}
