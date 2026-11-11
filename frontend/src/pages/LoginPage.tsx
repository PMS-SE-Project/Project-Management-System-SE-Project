import { Link } from 'react-router-dom'
import { Alert } from '../components/ui/Alert'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

export function LoginPage() {
  return (
    <div className="standalone-page">
      <Card className="login-card" elevated>
        <span className="brand-mark brand-mark-large" aria-hidden="true">P</span>
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in to ProjectHub</h1>
        <p className="page-description">Authentication will be connected in a future commit.</p>
        <div className="login-form" aria-label="Sign in preview">
          <Input label="Email address" type="email" placeholder="you@example.com" disabled />
          <Input label="Password" type="password" placeholder="••••••••" disabled />
          <Alert tone="info">This form is a preview and is not connected yet.</Alert>
        </div>
        <Link className="primary-button" to="/dashboard">Continue to dashboard</Link>
      </Card>
    </div>
  )
}
