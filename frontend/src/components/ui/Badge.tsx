import type { HTMLAttributes } from 'react'

export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'priority-low'
  | 'priority-medium'
  | 'priority-high'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

export function Badge({ children, className = '', tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span {...props} className={`ui-badge ui-badge-${tone} ${className}`.trim()}>
      {children}
    </span>
  )
}
