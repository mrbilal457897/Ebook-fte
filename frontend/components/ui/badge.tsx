import type { HTMLAttributes, ReactNode } from "react"

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "accent"

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone
  dot?: boolean
  children: ReactNode
}

export function Badge({
  tone = "neutral",
  dot = false,
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span className={`ui-badge ui-badge-${tone} ${className}`.trim()} {...rest}>
      {dot && <span className="ui-badge-dot" aria-hidden="true" />}
      {children}
    </span>
  )
}
