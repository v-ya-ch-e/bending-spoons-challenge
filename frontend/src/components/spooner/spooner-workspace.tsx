"use client"

import { useEffect, useState } from "react"

import { getCachedEmployees, listEmployees, type Employee } from "@/lib/db-api"
import { Skeleton } from "@/components/ui/skeleton"

type SpoonerWorkspaceProps = {
  spoonerId: number
  sectionLabel: string
}

type ResolutionState =
  | { status: "loading" }
  | { status: "found"; employee: Employee }
  | { status: "missing" }

export function SpoonerWorkspace({
  spoonerId,
  sectionLabel,
}: SpoonerWorkspaceProps) {
  const cachedEmployees = getCachedEmployees()
  const cachedEmployee = cachedEmployees?.find(
    (employee) => employee.id === spoonerId
  )
  const [resolution, setResolution] = useState<ResolutionState>(() => {
    if (cachedEmployee) {
      return { status: "found", employee: cachedEmployee }
    }
    if (cachedEmployees) {
      return { status: "missing" }
    }
    return { status: "loading" }
  })

  useEffect(() => {
    if (resolution.status !== "loading") return

    let isMounted = true

    listEmployees()
      .then((employees) => {
        if (!isMounted) return
        const employee = employees.find((entry) => entry.id === spoonerId)
        setResolution(
          employee
            ? { status: "found", employee }
            : { status: "missing" }
        )
      })
      .catch(() => {
        if (!isMounted) return
        setResolution({ status: "missing" })
      })

    return () => {
      isMounted = false
    }
  }, [resolution.status, spoonerId])

  if (resolution.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    )
  }

  if (resolution.status === "missing") {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xs">
          <p className="text-sm font-medium text-muted-foreground">
            Spooner workspace
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Spooner not found
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            No spooner with id {spoonerId}. Pick another from the profile menu.
          </p>
        </div>
      </div>
    )
  }

  const { employee } = resolution

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xs">
        <p className="text-sm font-medium text-muted-foreground">
          Spooner workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {sectionLabel}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Viewing as {employee.name} ({employee.role}).
        </p>
      </div>
    </div>
  )
}
