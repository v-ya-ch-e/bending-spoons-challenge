import { cn } from "@/lib/utils"

function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function colorFromName(name: string): string {
  return `hsl(${hashName(name) % 360} 60% 78%)`
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?"
}

type InitialAvatarProps = {
  name: string
  size?: number
  ringClass?: string
  className?: string
  ariaLabel?: string
}

export function InitialAvatar({
  name,
  size = 24,
  ringClass,
  className,
  ariaLabel,
}: InitialAvatarProps) {
  const initials = getInitials(name)
  const fontSize = Math.max(8.5, Math.round(size * 0.42))

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? name}
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-zinc-800 select-none",
        ringClass,
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: colorFromName(name),
        fontSize,
        lineHeight: 1,
      }}
    >
      {initials}
    </span>
  )
}
