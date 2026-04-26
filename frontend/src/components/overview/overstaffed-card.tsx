"use client"

import type { Project } from "@/lib/db-api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RailCard, RailCardHeader, RailEmptyState } from "./right-rail-card"
import { cn } from "@/lib/utils"

type OverstaffedCardProps = {
  projects: Project[]
  selectedProjectId?: number
  onProjectOpen: (projectId: number) => void
}

export function OverstaffedCard({
  projects,
  selectedProjectId,
  onProjectOpen,
}: OverstaffedCardProps) {
  const overstaffed = projects
    .map((project) => ({
      project,
      diff:
        project.current_team_members.length -
        project.required_people_amount,
    }))
    .filter((entry) => entry.diff > 0 && entry.project.required_people_amount > 0)
    .sort((left, right) => right.diff - left.diff)

  return (
    <RailCard>
      <RailCardHeader title="Overstaffed" count={overstaffed.length} />
      {overstaffed.length === 0 ? (
        <RailEmptyState label="No projects over capacity" />
      ) : (
        <ScrollArea className="-mx-2 min-h-0 flex-1">
          <ul className="flex flex-col px-2">
            {overstaffed.map(({ project, diff }) => {
              const isSelected = project.id === selectedProjectId

              return (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => onProjectOpen(project.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      isSelected && "bg-muted"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {project.project_name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {project.current_team_members.length}/
                      {project.required_people_amount}
                    </span>
                    <span className="w-7 shrink-0 text-right text-sm font-semibold text-[#10B981] tabular-nums">
                      +{diff}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      )}
    </RailCard>
  )
}
