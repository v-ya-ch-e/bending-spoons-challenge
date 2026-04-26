"use client"

import type { Employee, MoveRequest, SkillKey } from "@/lib/db-api"
import { skillKeys, skillTitles } from "@/lib/overview/skills-gaps"
import { DetailSection, DetailSheet } from "./detail-sheet"
import { InitialAvatar } from "./initial-avatar"
import { cn } from "@/lib/utils"

const skillBarColors: Record<0 | 1 | 2 | 3, string> = {
  0: "bg-transparent",
  1: "bg-[#A1A1AA]",
  2: "bg-[#71717A]",
  3: "bg-foreground",
}

const moveStatusColors: Record<MoveRequest["status"], string> = {
  pending: "#F59E0B",
  accepted: "#10B981",
  rejected: "#A1A1AA",
  clarification_requested: "#7C3AED",
  transition_started: "#3B82F6",
  completed: "#10B981",
}

type EmployeeDetailPanelProps = {
  employee: Employee | null
  pendingMoves: MoveRequest[]
  open: boolean
  onClose: () => void
}

export function EmployeeDetailPanel({
  employee,
  pendingMoves,
  open,
  onClose,
}: EmployeeDetailPanelProps) {
  const ariaLabel = employee ? `Employee ${employee.name}` : "Employee detail"

  return (
    <DetailSheet
      open={open && employee !== null}
      onClose={onClose}
      ariaLabel={ariaLabel}
    >
      {employee ? (
        <EmployeeDetailBody employee={employee} pendingMoves={pendingMoves} />
      ) : (
        <div className="p-6 text-sm text-muted-foreground">
          Select an engineer to see their details.
        </div>
      )}
    </DetailSheet>
  )
}

function EmployeeDetailBody({
  employee,
  pendingMoves,
}: {
  employee: Employee
  pendingMoves: MoveRequest[]
}) {
  const employeeMoves = pendingMoves.filter(
    (move) => move.employee_id === employee.id
  )
  const projects = employee.current_project_names.length
    ? employee.current_project_names.join(", ")
    : "Unassigned"

  return (
    <div className="flex flex-col gap-5 px-6 pt-7 pb-8">
      <div className="flex items-center gap-3 pr-8">
        <InitialAvatar name={employee.name} size={44} />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold leading-tight text-foreground">
            {employee.name}
          </h3>
          <p className="truncate text-sm text-muted-foreground">
            {employee.role}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {projects}
          </p>
        </div>
      </div>

      <DetailSection title="Skill matrix">
        <div className="flex flex-col gap-2.5">
          {skillKeys.map((skill) => (
            <SkillBar
              key={skill}
              skill={skill}
              level={employee.skills[skill] as 0 | 1 | 2 | 3}
            />
          ))}
        </div>
      </DetailSection>

      <DetailSection title="Pending moves">
        {employeeMoves.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending moves.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {employeeMoves.map((move) => (
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
                  <span className="text-muted-foreground">
                    {move.from_project_name ?? "Unassigned"}
                  </span>
                  <span className="mx-1.5 text-muted-foreground">→</span>
                  <span className="font-medium text-foreground">
                    {move.to_project_name}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>
    </div>
  )
}

function SkillBar({
  skill,
  level,
}: {
  skill: SkillKey
  level: 0 | 1 | 2 | 3
}) {
  const fraction = level / 3

  return (
    <div className="grid grid-cols-[6.5rem_1fr_1.25rem] items-center gap-3">
      <span className="text-sm text-muted-foreground">{skillTitles[skill]}</span>
      <span className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <span
          aria-hidden="true"
          className={cn("absolute inset-y-0 left-0 rounded-full", skillBarColors[level])}
          style={{ width: `${fraction * 100}%` }}
        />
      </span>
      <span className="text-right text-xs font-semibold tabular-nums text-foreground">
        L{level}
      </span>
    </div>
  )
}
