export interface SpinnerProps {
  size?: 'small' | 'medium' | 'large'
  label?: string
}

export function Spinner({ label = 'Loading', size = 'medium' }: SpinnerProps) {
  return (
    <span className={`ui-spinner ui-spinner-${size}`} role="status" aria-label={label} />
  )
}
