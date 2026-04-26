"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import type { Employee } from "@/lib/db-api"
import { DetailSheet } from "./detail-sheet"
import { InitialAvatar } from "./initial-avatar"

type UnassignedPanelProps = {
  employees: Employee[]
  open: boolean
  onClose: () => void
  onEmployeeOpen: (employeeId: number) => void
}

export function UnassignedPanel({
  employees,
  open,
  onClose,
  onEmployeeOpen,
}: UnassignedPanelProps) {
  return (
    <DetailSheet open={open} onClose={onClose} ariaLabel="Unassigned engineers">
      <div className="flex flex-col gap-4 px-6 pt-7 pb-8">
        <div className="pr-8">
          <h3 className="text-lg font-semibold leading-tight text-foreground">
            Unassigned · {employees.length}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Engineers without a current project.
          </p>
        </div>

        {employees.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Everyone is currently assigned.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {employees.map((employee) => (
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
      </div>
    </DetailSheet>
  )
}
