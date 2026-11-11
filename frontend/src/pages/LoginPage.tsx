import { Link } from 'react-router-dom'

export function LoginPage() {
  return (
    <div className="standalone-page">
      <div className="login-card">
        <span className="brand-mark brand-mark-large" aria-hidden="true">P</span>
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in to ProjectHub</h1>
        <p className="page-description">Authentication will be connected in a future commit.</p>
        <Link className="primary-button" to="/dashboard">Continue to dashboard</Link>
      </div>
    </div>
  )
}
