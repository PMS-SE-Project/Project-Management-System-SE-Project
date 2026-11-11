import { forwardRef, useId, type SelectHTMLAttributes } from 'react'

export interface SelectOption<Value extends string = string> {
  value: Value
  label: string
  disabled?: boolean
}

export interface SelectProps<Value extends string = string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'value' | 'onChange'> {
  label: string
  options: readonly SelectOption<Value>[]
  value?: Value
  onChange?: (value: Value) => void
  error?: string
  id?: string
  placeholder?: string
}

function SelectComponent<Value extends string>(
  {
    error,
    id,
    label,
    onChange,
    options,
    placeholder,
    required,
    value,
    ...props
  }: SelectProps<Value>,
  ref: React.ForwardedRef<HTMLSelectElement>,
) {
  const generatedId = useId()
  const selectId = id || generatedId
  const errorId = `${selectId}-error`

  return (
    <div className="form-field">
      <label className="form-label" htmlFor={selectId}>
        {label}
        {required && <span className="required-mark" aria-hidden="true"> *</span>}
      </label>
      <select
        {...props}
        ref={ref}
        className={`ui-select${error ? ' ui-input-error' : ''}`}
        id={selectId}
        value={value}
        required={required}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange?.(event.target.value as Value)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option disabled={option.disabled} key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="field-error" id={errorId}>{error}</span>}
    </div>
  )
}

export const Select = forwardRef(SelectComponent) as <
  Value extends string = string,
>(
  props: SelectProps<Value> & { ref?: React.ForwardedRef<HTMLSelectElement> },
) => React.ReactElement
