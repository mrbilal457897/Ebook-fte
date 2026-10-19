import { useId } from "react"
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react"

type Message = { id: string; error?: string; hint?: string }

function FieldMessage({ id, error, hint }: Message) {
  const text = error ?? hint ?? ""
  if (!text) return <p className="field-hint" id={id} aria-hidden="true" />
  return error ? (
    <p className="field-error" id={id} role="alert">
      {text}
    </p>
  ) : (
    <p className="field-hint" id={id}>
      {text}
    </p>
  )
}

function fieldLabel(label: string, required?: boolean) {
  return required ? `${label} *` : label
}

type SharedFieldProps = {
  label: string
  error?: string
  hint?: string
}

export type InputProps = SharedFieldProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
    controlClassName?: string
  }

export function Input({
  label,
  error,
  hint,
  required,
  id,
  controlClassName = "",
  ...rest
}: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  const classes = ["field-input", error ? "is-error" : "", controlClassName]
    .filter(Boolean)
    .join(" ")
  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {fieldLabel(label, required)}
      </label>
      <input
        id={inputId}
        className={classes}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        {...rest}
      />
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  )
}

export type TextareaProps = SharedFieldProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
    controlClassName?: string
  }

export function Textarea({
  label,
  error,
  hint,
  required,
  id,
  controlClassName = "",
  ...rest
}: TextareaProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  const classes = ["field-textarea", error ? "is-error" : "", controlClassName]
    .filter(Boolean)
    .join(" ")
  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {fieldLabel(label, required)}
      </label>
      <textarea
        id={inputId}
        className={classes}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        {...rest}
      />
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  )
}

export type SelectProps = SharedFieldProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
    controlClassName?: string
    children: ReactNode
  }

export function Select({
  label,
  error,
  hint,
  required,
  id,
  controlClassName = "",
  children,
  ...rest
}: SelectProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  const classes = ["field-select", error ? "is-error" : "", controlClassName]
    .filter(Boolean)
    .join(" ")
  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {fieldLabel(label, required)}
      </label>
      <select
        id={inputId}
        className={classes}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        {...rest}
      >
        {children}
      </select>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  )
}
