import type { HTMLAttributes } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean
}

export function Card({ children, className = '', elevated = false, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`ui-card${elevated ? ' ui-card-elevated' : ''} ${className}`.trim()}
    >
      {children}
    </div>
  )
}
