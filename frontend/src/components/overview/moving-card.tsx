"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons"

import type { MoveRequest } from "@/lib/db-api"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { InitialAvatar } from "./initial-avatar"
import { RailCard, RailCardHeader, RailEmptyState } from "./right-rail-card"
import { cn } from "@/lib/utils"

const PREVIEW_LIMIT = 4

type MovingCardProps = {
  pendingMoves: MoveRequest[]
  selectedEmployeeId?: number
  onEmployeeOpen: (employeeId: number) => void
}

export function MovingCard({
  pendingMoves,
  selectedEmployeeId,
  onEmployeeOpen,
}: MovingCardProps) {
  const showAll = pendingMoves.length > PREVIEW_LIMIT
  const visibleMoves = showAll ? pendingMoves.slice(0, PREVIEW_LIMIT) : pendingMoves

  return (
    <RailCard>
      <RailCardHeader title="Moving" count={pendingMoves.length} showAll={showAll} />
      {visibleMoves.length === 0 ? (
        <RailEmptyState label="No pending moves" />
      ) : (
        <ScrollArea className="-mx-2 min-h-0 flex-1">
          <ul className="flex flex-col px-2">
            {visibleMoves.map((move) => {
              const firstName = getFirstName(move.employee_name)
              const isSelected = move.employee_id === selectedEmployeeId

              return (
                <li
                  key={move.id}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-muted",
                    isSelected && "bg-muted"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onEmployeeOpen(move.employee_id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-2xl"
                  >
                    <InitialAvatar
                      name={move.employee_name}
                      size={32}
                      ringClass="ring-1 ring-card"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="min-w-0 truncate text-sm">
                        <span className="font-medium text-foreground">
                          {firstName}
                        </span>
                        <span className="mx-1.5 text-muted-foreground">
                          →
                        </span>
                        <span className="truncate font-medium text-foreground">
                          {move.to_project_name}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        In transit
                      </p>
                    </div>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`More actions for ${move.employee_name}`}
                    className="shrink-0 opacity-50 group-hover:opacity-100"
                  >
                    <HugeiconsIcon
                      icon={MoreHorizontalIcon}
                      strokeWidth={2}
                      className="size-4"
                    />
                  </Button>
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      )}
    </RailCard>
  )
}

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}
