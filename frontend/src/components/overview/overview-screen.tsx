"use client"

import { useEffect, useMemo, useState } from "react"

import {
  getCachedEmployees,
  getCachedMoveRequests,
  getCachedProjects,
  listEmployees,
  listMoveRequests,
  listProjects,
  type Employee,
  type MoveRequest,
  type Project,
} from "@/lib/db-api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { EmployeeDetailPanel } from "./employee-detail-panel"
import { MovingCard } from "./moving-card"
import { OverstaffedCard } from "./overstaffed-card"
import { PortfolioGraph } from "./portfolio-graph"
import { ProjectDetailPanel } from "./project-detail-panel"
import { SkillsGaps } from "./skills-gaps"
import { TotalEngineersCard } from "./total-engineers-card"
import { UnassignedPanel } from "./unassigned-panel"
import { UnderstaffedCard } from "./understaffed-card"
import { cn } from "@/lib/utils"

const phaseFilters = [
  { value: "all", label: "All projects" },
  { value: "growth", label: "Growth only" },
  { value: "maintenance", label: "Maintenance only" },
  { value: "new acquisition", label: "New acquisition only" },
] as const

type PhaseFilter = (typeof phaseFilters)[number]["value"]

export function OverviewScreen() {
  const [projects, setProjects] = useState<Project[]>(
    () => getCachedProjects() ?? []
  )
  const [employees, setEmployees] = useState<Employee[]>(
    () => getCachedEmployees() ?? []
  )
  const [moveRequests, setMoveRequests] = useState<MoveRequest[]>(
    () => getCachedMoveRequests() ?? []
  )
  const [isLoading, setIsLoading] = useState(
    () =>
      !getCachedProjects() ||
      !getCachedEmployees() ||
      !getCachedMoveRequests()
  )
  const [error, setError] = useState<string | null>(null)
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("all")
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null
  )
  const [unassignedOpen, setUnassignedOpen] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        setError(null)
        const [nextProjects, nextEmployees, nextMoves] = await Promise.all([
          listProjects(),
          listEmployees(),
          listMoveRequests(),
        ])
        if (!isMounted) return
        setProjects(nextProjects)
        setEmployees(nextEmployees)
        setMoveRequests(nextMoves)
      } catch (loadError) {
        if (!isMounted) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load overview data."
        )
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  const filteredProjects = useMemo(() => {
    if (phaseFilter === "all") return projects
    return projects.filter((project) => project.project_phase === phaseFilter)
  }, [projects, phaseFilter])

  const pendingMoves = useMemo(
    () => moveRequests.filter((move) => move.status === "pending"),
    [moveRequests]
  )

  const unassignedEmployees = useMemo(
    () =>
      employees.filter(
        (employee) => employee.current_project_ids.length === 0
      ),
    [employees]
  )

  const understaffedCount = useMemo(
    () =>
      filteredProjects.filter(
        (project) =>
          project.required_people_amount > 0 &&
          project.current_team_members.length < project.required_people_amount
      ).length,
    [filteredProjects]
  )

  const overstaffedCount = useMemo(
    () =>
      filteredProjects.filter(
        (project) =>
          project.required_people_amount > 0 &&
          project.current_team_members.length > project.required_people_amount
      ).length,
    [filteredProjects]
  )

  const selectedProject = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId) ?? null
    : null
  const selectedEmployee = selectedEmployeeId
    ? employees.find((employee) => employee.id === selectedEmployeeId) ?? null
    : null

  function openProject(projectId: number) {
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null)
      return
    }
    setSelectedProjectId(projectId)
    setSelectedEmployeeId(null)
    setUnassignedOpen(false)
  }

  function openEmployee(employeeId: number) {
    if (selectedEmployeeId === employeeId) {
      setSelectedEmployeeId(null)
      return
    }
    setSelectedEmployeeId(employeeId)
    setSelectedProjectId(null)
    setUnassignedOpen(false)
  }

  function openUnassigned() {
    if (unassignedOpen) {
      setUnassignedOpen(false)
      return
    }
    setUnassignedOpen(true)
    setSelectedProjectId(null)
    setSelectedEmployeeId(null)
  }

  function closeAllPanels() {
    setSelectedProjectId(null)
    setSelectedEmployeeId(null)
    setUnassignedOpen(false)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
        <header className="flex flex-col gap-3">
          <div className="max-w-2xl">
            <h1
              className="font-semibold tracking-tight text-foreground"
              style={{ fontSize: 26, lineHeight: 1.15 }}
            >
              Overview
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Visualize your engineering portfolio. See where people are, where
              they&apos;re going, and where you&apos;re short.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={phaseFilter}
              onValueChange={(value) => setPhaseFilter(value as PhaseFilter)}
            >
              <SelectTrigger
                size="sm"
                aria-label="Filter projects by phase"
                className="min-w-44"
              >
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {phaseFilters.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <StatPill label="Projects" value={projects.length} />
            <StatPill label="Engineers" value={employees.length} />
            <StatPill
              label="Pending moves"
              value={pendingMoves.length}
              color="text-amber-600 dark:text-amber-400"
            />
            <StatPill
              label="Understaffed"
              value={understaffedCount}
              color="text-[#EF4444]"
            />
            <StatPill
              label="Overstaffed"
              value={overstaffedCount}
              color="text-[#10B981]"
            />
          </div>
        </header>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load overview</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div
              className="rounded-3xl border border-border bg-card shadow-sm"
              style={{ height: 620 }}
            >
              {isLoading && projects.length === 0 ? (
                <Skeleton className="h-full w-full rounded-3xl" />
              ) : (
                <PortfolioGraph
                  projects={filteredProjects}
                  unassignedEmployees={unassignedEmployees}
                  pendingMoves={pendingMoves}
                  selectedProjectId={selectedProjectId ?? undefined}
                  selectedEmployeeId={selectedEmployeeId ?? undefined}
                  onProjectClick={openProject}
                  onEmployeeClick={openEmployee}
                  onUnassignedClick={openUnassigned}
                />
              )}
            </div>

            <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MovingCard
                pendingMoves={pendingMoves}
                selectedEmployeeId={selectedEmployeeId ?? undefined}
                onEmployeeOpen={openEmployee}
              />
              <UnderstaffedCard
                projects={filteredProjects}
                selectedProjectId={selectedProjectId ?? undefined}
                onProjectOpen={openProject}
              />
              <OverstaffedCard
                projects={filteredProjects}
                selectedProjectId={selectedProjectId ?? undefined}
                onProjectOpen={openProject}
              />
              <TotalEngineersCard
                total={employees.length}
                assigned={employees.length - unassignedEmployees.length}
                unassigned={unassignedEmployees.length}
              />
            </div>

            <SkillsGaps
              projects={projects}
              employees={employees}
              onProjectOpen={openProject}
            />
          </>
        )}
      </div>

      <ProjectDetailPanel
        project={selectedProject}
        employees={employees}
        pendingMoves={pendingMoves}
        open={selectedProjectId !== null}
        onClose={closeAllPanels}
        onEmployeeOpen={openEmployee}
      />
      <EmployeeDetailPanel
        employee={selectedEmployee}
        pendingMoves={pendingMoves}
        open={selectedEmployeeId !== null}
        onClose={closeAllPanels}
      />
      <UnassignedPanel
        employees={unassignedEmployees}
        open={unassignedOpen}
        onClose={closeAllPanels}
        onEmployeeOpen={openEmployee}
      />
    </div>
  )
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3 py-1.5 text-xs">
      <span className="text-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", color)}>{value}</span>
    </span>
  )
}
