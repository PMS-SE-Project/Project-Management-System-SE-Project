import { forwardRef, useId, type InputHTMLAttributes } from 'react'

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  error?: string
  id?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, id, label, required, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id || generatedId
  const errorId = `${inputId}-error`

  return (
    <div className="form-field">
      <label className="form-label" htmlFor={inputId}>
        {label}
        {required && <span className="required-mark" aria-hidden="true"> *</span>}
      </label>
      <input
        {...props}
        ref={ref}
        className={`ui-input${error ? ' ui-input-error' : ''}`}
        id={inputId}
        required={required}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
      />
      {error && <span className="field-error" id={errorId}>{error}</span>}
    </div>
  )
})
