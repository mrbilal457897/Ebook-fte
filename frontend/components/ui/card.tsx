import type { HTMLAttributes, ReactNode } from "react"

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  selected?: boolean
  raised?: boolean
  children: ReactNode
}

export function Card({ selected, raised, className = "", children, ...rest }: CardProps) {
  const classes = ["ui-card", selected ? "is-selected" : "", raised ? "is-raised" : "", className]
    .filter(Boolean)
    .join(" ")
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
