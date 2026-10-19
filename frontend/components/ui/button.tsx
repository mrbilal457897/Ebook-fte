import type { ButtonHTMLAttributes, ReactNode } from "react"
import Link from "next/link"

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive"
export type ButtonSize = "sm" | "md" | "lg"

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  destructive: "btn-destructive",
}

function classNames(
  variant: ButtonVariant,
  size: ButtonSize,
  loading: boolean,
  solid: boolean,
  className: string,
) {
  return [
    VARIANT_CLASS[variant],
    `btn-${size}`,
    loading ? "is-loading" : "",
    solid && variant === "destructive" ? "is-solid" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  solid?: boolean
  children: ReactNode
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  solid = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames(variant, size, loading, solid, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className="btn-content">
        {loading && <span className="btn-spinner" aria-hidden="true" />}
        {children}
      </span>
    </button>
  )
}

export type ButtonLinkProps = {
  href: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: ButtonLinkProps) {
  return (
    <Link href={href} className={classNames(variant, size, false, false, className)}>
      <span className="btn-content">{children}</span>
    </Link>
  )
}
