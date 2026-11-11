import { useState, type FormEvent } from 'react'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

interface LoginFormValues {
  email: string
  password: string
}

interface LoginErrors {
  email?: string
  password?: string
}

function validate(values: LoginFormValues): LoginErrors {
  const errors: LoginErrors = {}
  const email = values.email.trim()

  if (!email) {
    errors.email = 'Email is required.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!values.password) {
    errors.password = 'Password is required.'
  }

  return errors
}

export function LoginPage() {
  const [values, setValues] = useState<LoginFormValues>({ email: '', password: '' })
  const [errors, setErrors] = useState<LoginErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  function updateField(field: keyof LoginFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    if (hasSubmitted) {
      setErrors(validate({ ...values, [field]: value }))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validate(values)
    setHasSubmitted(true)
    setErrors(validationErrors)
    setAuthError(null)
  }

  return (
    <div className="standalone-page">
      <div className="login-layout">
        <Card className="login-card" elevated>
          <div className="login-brand">
            <span className="brand-mark brand-mark-large" aria-hidden="true">P</span>
            <span className="login-brand-name">ProjectHub</span>
          </div>
          <p className="eyebrow">Welcome back</p>
          <h1>Good work starts here<span className="heading-dot">.</span></h1>
          <p className="page-description">Sign in to keep your projects moving with a little more ease.</p>
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <Input
              autoComplete="email"
              error={errors.email}
              id="login-email"
              label="Email address"
              name="email"
              onChange={(event) => updateField('email', event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={values.email}
              required
            />
            <div className="password-control">
              <Input
                autoComplete="current-password"
                error={errors.password}
                id="login-password"
                label="Password"
                name="password"
                onChange={(event) => updateField('password', event.target.value)}
                placeholder="Your password"
                type={showPassword ? 'text' : 'password'}
                value={values.password}
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <Alert tone="info">Sign-in is not connected yet. No credentials will be sent.</Alert>
            {authError && <Alert tone="error">{authError}</Alert>}
            <Button type="submit">Sign in</Button>
          </form>
          <div aria-live="polite">
            {hasSubmitted && Object.keys(errors).length === 0 && (
              <p className="form-status">Your details look good. Backend sign-in will be added next.</p>
            )}
          </div>
        </Card>
        <aside className="login-art-panel" aria-hidden="true">
          <div className="art-orbit art-orbit-one" aria-hidden="true" />
          <div className="art-orbit art-orbit-two" aria-hidden="true" />
          <span className="art-title">login</span>
          <div className="art-note art-note-pink" />
          <div className="art-note art-note-blue" />
          <div className="art-note art-note-mint" />
          <div className="art-note art-note-neutral" />
          <span className="art-star" aria-hidden="true">✦</span>
        </aside>
      </div>
    </div>
  )
}
