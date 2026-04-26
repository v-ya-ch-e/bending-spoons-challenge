import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function RailCard({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        "flex h-80 min-h-0 flex-col gap-3 rounded-3xl border border-border bg-card p-4 shadow-sm",
        className
      )}
    >
      {children}
    </section>
  )
}

type RailCardHeaderProps = {
  title: string
  count: number
  showAll?: boolean
  onViewAll?: () => void
}

export function RailCardHeader({
  title,
  count,
  showAll,
  onViewAll,
}: RailCardHeaderProps) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-foreground">
        {title}{" "}
        <span className="text-muted-foreground tabular-nums">({count})</span>
      </h3>
      {showAll && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={onViewAll}
        >
          View all
        </Button>
      )}
    </div>
  )
}

export function RailEmptyState({ label }: { label: string }) {
  return (
    <p className="shrink-0 px-3 py-2 text-xs text-muted-foreground">{label}</p>
  )
}
