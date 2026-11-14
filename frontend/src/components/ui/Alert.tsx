import type { HTMLAttributes } from 'react'

export type AlertTone = 'success' | 'error' | 'warning' | 'info'

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone
  title?: string
  onClose?: () => void
}

export function Alert({
  children,
  className = '',
  onClose,
  title,
  tone = 'info',
  ...props
}: AlertProps) {
  return (
    <div
      {...props}
      className={`ui-alert ui-alert-${tone} ${className}`.trim()}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className="alert-icon" aria-hidden="true">
        {tone === 'success' ? '✓' : tone === 'error' ? '!' : tone === 'warning' ? '△' : 'i'}
      </span>
      <div className="alert-content">
        {title && <strong>{title}</strong>}
        <span>{children}</span>
      </div>
      {onClose && (
        <button className="alert-close" type="button" onClick={onClose} aria-label="Dismiss message">
          ×
        </button>
      )}
    </div>
  )
}
