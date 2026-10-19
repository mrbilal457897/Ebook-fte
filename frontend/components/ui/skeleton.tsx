import type { CSSProperties } from "react"

export type SkeletonProps = {
  width?: string
  height?: string
  radius?: string
  className?: string
}

export function Skeleton({
  width = "100%",
  height = "1em",
  radius,
  className = "",
}: SkeletonProps) {
  const style: CSSProperties = { width, height }
  if (radius) style.borderRadius = radius
  return <span className={`ui-skeleton ${className}`.trim()} style={style} aria-hidden="true" />
}

export function SkeletonText({
  lines = 3,
  lastWidth = "62%",
}: {
  lines?: number
  lastWidth?: string
}) {
  return (
    <span
      aria-hidden="true"
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", width: "100%" }}
    >
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className="ui-skeleton ui-skeleton-text"
          style={{ width: i === lines - 1 ? lastWidth : "100%" }}
        />
      ))}
    </span>
  )
}
