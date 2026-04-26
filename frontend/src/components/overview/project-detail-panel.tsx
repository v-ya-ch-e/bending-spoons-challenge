"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import type { Employee, MoveRequest, Project, SkillKey } from "@/lib/db-api"
import { skillKeys, skillTitles } from "@/lib/overview/skills-gaps"
import { Badge } from "@/components/ui/badge"
import {
  CapacityRing,
  capacityColors,
  getCapacityState,
} from "./capacity-ring"
import { DetailSection, DetailSheet } from "./detail-sheet"
import { InitialAvatar } from "./initial-avatar"
import { cn } from "@/lib/utils"

const phaseDotColors: Record<Project["project_phase"], string> = {
  growth: "#10B981",
  maintenance: "#64748B",
  "new acquisition": "#7C3AED",
}

const phaseLabels: Record<Project["project_phase"], string> = {
  growth: "Growth",
  maintenance: "Maintenance",
  "new acquisition": "New acquisition",
}

const moveStatusColors: Record<MoveRequest["status"], string> = {
  pending: "#F59E0B",
  accepted: "#10B981",
  rejected: "#A1A1AA",
  clarification_requested: "#7C3AED",
  transition_started: "#3B82F6",
  completed: "#10B981",
}

type ProjectDetailPanelProps = {
  project: Project | null
  employees: Employee[]
  pendingMoves: MoveRequest[]
  open: boolean
  onClose: () => void
  onEmployeeOpen: (employeeId: number) => void
}

export function ProjectDetailPanel({
  project,
  employees,
  pendingMoves,
  open,
  onClose,
  onEmployeeOpen,
}: ProjectDetailPanelProps) {
  const ariaLabel = project ? `Project ${project.project_name}` : "Project detail"

  return (
    <DetailSheet open={open && project !== null} onClose={onClose} ariaLabel={ariaLabel}>
      {project ? (
        <ProjectDetailBody
          project={project}
          employees={employees}
          pendingMoves={pendingMoves}
          onEmployeeOpen={onEmployeeOpen}
        />
      ) : (
        <div className="p-6 text-sm text-muted-foreground">
          Select a project from the graph to see its details.
        </div>
      )}
    </DetailSheet>
  )
}

function ProjectDetailBody({
  project,
  employees,
  pendingMoves,
  onEmployeeOpen,
}: {
  project: Project
  employees: Employee[]
  pendingMoves: MoveRequest[]
  onEmployeeOpen: (employeeId: number) => void
}) {
  const team = employees.filter((employee) =>
    project.current_team_member_ids.includes(employee.id)
  )
  const involvedMoves = pendingMoves.filter(
    (move) =>
      move.from_project_id === project.id || move.to_project_id === project.id
  )
  const state = getCapacityState(
    project.current_team_members.length,
    project.required_people_amount
  )

  return (
    <div className="flex flex-col gap-5 px-6 pt-7 pb-8">
      <div className="flex items-start gap-4">
        <div className="relative grid size-16 shrink-0 place-items-center">
          <span className="absolute inset-0 rounded-full border border-border bg-card" />
          <CapacityRing size={64} state={state} strokeWidth={4} />
          <span
            aria-hidden="true"
            className="relative inline-block size-2 rounded-full"
            style={{ backgroundColor: capacityColors[state] }}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-2 pr-8">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: phaseDotColors[project.project_phase] }}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {phaseLabels[project.project_phase]}
            </span>
          </div>
          <h3 className="text-lg font-semibold leading-tight text-foreground">
            {project.project_name}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="font-medium tabular-nums">
              {project.current_team_members.length}/
              {project.required_people_amount} engineers
            </Badge>
            <Badge variant="outline" className="font-medium tabular-nums">
              {involvedMoves.length} in motion
            </Badge>
          </div>
        </div>
      </div>

      <DetailSection title="Required skills">
        <div className="flex flex-col gap-2">
          {skillKeys.map((skill) => (
            <SkillRequirementRow
              key={skill}
              skill={skill}
              required={project.required_skills[skill]}
            />
          ))}
        </div>
      </DetailSection>

      <DetailSection title="Team">
        {team.length === 0 ? (
          <p className="text-sm text-muted-foreground">No engineers assigned.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {team.map((employee) => (
              <li key={employee.id}>
                <button
                  type="button"
                  onClick={() => onEmployeeOpen(employee.id)}
                  className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <InitialAvatar name={employee.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {employee.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {employee.role}
                    </span>
                  </span>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    strokeWidth={2}
                    className="size-4 text-muted-foreground"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      <DetailSection title="Move requests">
        {involvedMoves.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending moves.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {involvedMoves.map((move) => {
              const otherProject =
                move.to_project_id === project.id
                  ? move.from_project_name ?? "Unassigned"
                  : move.to_project_name
              const arrow = move.to_project_id === project.id ? "←" : "→"

              return (
                <li
                  key={move.id}
                  className="flex items-center gap-2.5 rounded-2xl bg-muted/40 px-3 py-2 text-sm"
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: moveStatusColors[move.status] }}
                  />
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-foreground">
                      {move.employee_name}
                    </span>
                    <span className="mx-1.5 text-muted-foreground">
                      {arrow}
                    </span>
                    <span className="text-muted-foreground">{otherProject}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </DetailSection>
    </div>
  )
}

function SkillRequirementRow({
  skill,
  required,
}: {
  skill: SkillKey
  required: { level_1: number; level_2: number; level_3: number }
}) {
  const total = required.level_1 + required.level_2 + required.level_3

  if (total === 0) {
    return null
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-3 py-2">
      <span className="text-sm text-foreground">{skillTitles[skill]}</span>
      <span className="inline-flex items-center gap-1">
        {required.level_3 > 0 && (
          <RequiredPill level={3} count={required.level_3} />
        )}
        {required.level_2 > 0 && (
          <RequiredPill level={2} count={required.level_2} />
        )}
        {required.level_1 > 0 && (
          <RequiredPill level={1} count={required.level_1} />
        )}
      </span>
    </div>
  )
}

function RequiredPill({ level, count }: { level: 1 | 2 | 3; count: number }) {
  const styles = {
    3: "bg-[#EF4444]/10 text-[#EF4444]",
    2: "bg-[#F59E0B]/15 text-[#B45309] dark:text-[#F59E0B]",
    1: "bg-zinc-200/60 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200",
  }[level]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        styles
      )}
    >
      L{level}×{count}
    </span>
  )
}
