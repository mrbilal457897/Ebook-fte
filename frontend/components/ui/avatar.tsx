export type AvatarSize = "sm" | "md" | "lg"

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2)
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export type AvatarProps = {
  name: string
  size?: AvatarSize
  className?: string
}

export function Avatar({ name, size = "md", className = "" }: AvatarProps) {
  const classes = ["ui-avatar", size !== "md" ? `ui-avatar-${size}` : "", className]
    .filter(Boolean)
    .join(" ")
  return (
    <span className={classes} role="img" aria-label={name}>
      {initials(name)}
    </span>
  )
}
