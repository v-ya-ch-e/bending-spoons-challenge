"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { getCachedEmployees, listEmployees, type Employee } from "@/lib/db-api"
import type { SpoonerPickerInitialData } from "@/lib/server/db-api"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { HugeiconsIcon } from "@hugeicons/react"
import { SearchIcon } from "@hugeicons/core-free-icons"

const defaultSection = "my-project"

export function SpoonerPickerScreen({
  initialData,
}: {
  initialData?: SpoonerPickerInitialData | null
}) {
  const cachedEmployees = getCachedEmployees()
  const [employees, setEmployees] = useState<Employee[]>(
    () => initialData?.employees ?? cachedEmployees ?? []
  )
  const [isLoading, setIsLoading] = useState(() => !initialData && !cachedEmployees)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (initialData) {
      return
    }

    let isMounted = true

    listEmployees()
      .then((nextEmployees) => {
        if (!isMounted) return
        setEmployees(nextEmployees)
        setError(null)
      })
      .catch((nextError: unknown) => {
        if (!isMounted) return
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Could not load employees"
        )
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [initialData])

  const filteredEmployees = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    const sorted = [...employees].sort((a, b) => a.name.localeCompare(b.name))
    if (!trimmed) return sorted
    return sorted.filter((employee) =>
      `${employee.name} ${employee.role}`.toLowerCase().includes(trimmed)
    )
  }, [employees, query])

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          Spooner workspace
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Pick a spooner to view as
        </h1>
        <p className="text-sm text-muted-foreground">
          Select an employee to load their workspace. You can switch later from
          the profile menu.
        </p>
      </header>

      <InputGroup className="h-10">
        <InputGroupInput
          placeholder="Search by name or role"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <InputGroupAddon>
          <HugeiconsIcon
            icon={SearchIcon}
            strokeWidth={2}
            className="size-4 shrink-0 opacity-50"
          />
        </InputGroupAddon>
      </InputGroup>

      {error && !isLoading && (
        <Alert variant="destructive">
          <AlertTitle>Could not load employees</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && employees.length === 0 ? (
        <div className="grid gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredEmployees.length === 0 ? (
        <p className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No spooners match {`"${query}"`}.
        </p>
      ) : (
        <ul className="grid gap-2">
          {filteredEmployees.map((employee) => (
            <li key={employee.id}>
              <Link
                href={`/spooner/${employee.id}/${defaultSection}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted"
              >
                <Avatar size="lg">
                  <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {employee.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {employee.role}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?"
}
