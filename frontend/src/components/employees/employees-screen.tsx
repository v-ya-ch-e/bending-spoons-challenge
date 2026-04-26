"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Cancel01Icon, Edit02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  getGithubProfileUrl,
  getCachedEmployees,
  getCachedProjects,
  listEmployees,
  listProjects,
  type Employee,
  type Project,
  type ProjectSkillRequirements,
  type SkillKey,
  type Skills,
} from "@/lib/db-api"
import type { EmployeesInitialData } from "@/lib/server/db-api"
import { CreateEmployeeDialog } from "@/components/employees/create-employee-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getEmployeeAvatarSrc } from "@/lib/employee-avatars"
import { cn } from "@/lib/utils"

type EmployeesScreenProps = {
  selectedEmployeeId?: string
  initialData?: EmployeesInitialData | null
}

type FilterKey = "all" | "assigned" | "unassigned"
type SortKey = "name" | "role" | "project"

const skillLabels: Record<SkillKey, string> = {
  android: "Android",
  ios: "iOS",
  web: "Web",
  backend: "Backend",
  infrastructure: "Infra",
  ai: "AI",
}

const skillRequirementLevels = [1, 2, 3] as const
type SkillRequirementLevel = (typeof skillRequirementLevels)[number]

const filterItems: Array<{
  value: FilterKey
  label: string
}> = [
  { value: "all", label: "All" },
  { value: "assigned", label: "Assigned" },
  { value: "unassigned", label: "Unassigned" },
]

export function EmployeesScreen({
  selectedEmployeeId,
  initialData,
}: EmployeesScreenProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const cachedEmployees = getCachedEmployees()
  const cachedProjects = getCachedProjects()
  const [employees, setEmployees] = useState<Employee[]>(
    () => initialData?.employees ?? cachedEmployees ?? []
  )
  const [projects, setProjects] = useState<Project[]>(
    () => initialData?.projects ?? cachedProjects ?? []
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<FilterKey>("all")
  const [sort, setSort] = useState<SortKey>("name")
  const [isLoading, setIsLoading] = useState(
    () => !initialData && (!cachedEmployees || !cachedProjects)
  )
  const [error, setError] = useState<string | null>(null)
  const [activeEmployeeId, setActiveEmployeeId] = useState(selectedEmployeeId)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const createDialogOpen = searchParams.get("create") === "1"

  useEffect(() => {
    if (initialData) {
      return
    }

    let isMounted = true

    async function loadEmployeesWorkspace() {
      try {
        if (!getCachedEmployees() || !getCachedProjects()) {
          setIsLoading(true)
        }
        setError(null)
        const [nextEmployees, nextProjects] = await Promise.all([
          listEmployees(),
          listProjects(),
        ])

        if (!isMounted) {
          return
        }

        setEmployees(nextEmployees)
        setProjects(nextProjects)
      } catch (loadError) {
        if (!isMounted) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load employee data."
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadEmployeesWorkspace()

    return () => {
      isMounted = false
    }
  }, [initialData])

  useEffect(() => {
    function handlePopState() {
      setActiveEmployeeId(getEmployeeIdFromPath(window.location.pathname))
    }

    window.addEventListener("popstate", handlePopState)

    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const projectByName = useMemo(() => {
    return new Map(projects.map((project) => [project.project_name, project]))
  }, [projects])

  const selectedEmployee = useMemo(() => {
    return employees.find((employee) => String(employee.id) === activeEmployeeId)
  }, [activeEmployeeId, employees])

  const selectedProject = selectedEmployee?.current_project
    ? projectByName.get(selectedEmployee.current_project)
    : undefined

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return employees
      .filter((employee) => {
        if (filter === "assigned" && !employee.current_project) {
          return false
        }

        if (filter === "unassigned" && employee.current_project) {
          return false
        }

        if (!normalizedSearch) {
          return true
        }

        const searchableText = [
          employee.name,
          employee.role,
          employee.github_username ?? "",
          employee.github_username ? `@${employee.github_username}` : "",
          employee.current_project ?? "",
          ...employee.preferences,
          ...employee.interests,
        ]
          .join(" ")
          .toLowerCase()

        return searchableText.includes(normalizedSearch)
      })
      .sort((leftEmployee, rightEmployee) => {
        if (sort === "role") {
          return leftEmployee.role.localeCompare(rightEmployee.role)
        }

        if (sort === "project") {
          return (leftEmployee.current_project ?? "Unassigned").localeCompare(
            rightEmployee.current_project ?? "Unassigned"
          )
        }

        return leftEmployee.name.localeCompare(rightEmployee.name)
      })
  }, [employees, filter, searchQuery, sort])

  const metrics = useMemo(() => {
    const assignedCount = employees.filter((employee) => employee.current_project).length
    const representedProjects = new Set(
      employees
        .map((employee) => employee.current_project)
        .filter((projectName): projectName is string => Boolean(projectName))
    )

    return [
      {
        label: "Total employees",
        value: employees.length,
      },
      {
        label: "Assigned",
        value: assignedCount,
      },
      {
        label: "Unassigned",
        value: employees.length - assignedCount,
      },
      {
        label: "Companies represented",
        value: representedProjects.size,
      },
    ]
  }, [employees])

  function handleCreateDialogOpenChange(open: boolean) {
    if (open) {
      router.push("/cto/employees?create=1")
      return
    }

    router.replace(pathname)
  }

  function handleEmployeeCreated(employee: Employee) {
    upsertEmployee(employee)
    setError(null)
    openEmployeeProfile(employee.id, "replace")
  }

  function handleEmployeeSaved(employee: Employee) {
    upsertEmployee(employee)
    setError(null)
    setEditingEmployee(null)
    openEmployeeProfile(employee.id, "replace")
  }

  function upsertEmployee(employee: Employee) {
    setEmployees((currentEmployees) => {
      const exists = currentEmployees.some(
        (currentEmployee) => currentEmployee.id === employee.id
      )

      if (exists) {
        return currentEmployees.map((currentEmployee) =>
          currentEmployee.id === employee.id ? employee : currentEmployee
        )
      }

      return [...currentEmployees, employee]
    })
  }

  function openEmployeeProfile(employeeId: number, mode: "push" | "replace" = "push") {
    const nextPath = `/cto/employees/${employeeId}`
    setActiveEmployeeId(String(employeeId))

    if (mode === "replace") {
      window.history.replaceState(null, "", nextPath)
      return
    }

    window.history.pushState(null, "", nextPath)
  }

  function closeEmployeeProfile() {
    setActiveEmployeeId(undefined)
    window.history.pushState(null, "", "/cto/employees")
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {createDialogOpen && (
        <CreateEmployeeDialog
          open={createDialogOpen}
          projects={projects}
          onOpenChange={handleCreateDialogOpenChange}
          onCreated={handleEmployeeCreated}
        />
      )}
      {editingEmployee && (
        <CreateEmployeeDialog
          open={Boolean(editingEmployee)}
          mode="edit"
          employee={editingEmployee}
          projects={projects}
          onOpenChange={(open) => {
            if (!open) {
              setEditingEmployee(null)
            }
          }}
          onCreated={handleEmployeeSaved}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage internal talent and understand current company allocation.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <InputGroup className="w-full sm:w-80">
              <InputGroupAddon>
                <span>Search</span>
              </InputGroupAddon>
              <InputGroupInput
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Name, role, company, interest..."
                aria-label="Search employees"
              />
            </InputGroup>

            <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
              <SelectTrigger
                size="sm"
                aria-label="Sort employees"
                className="min-w-36"
              >
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="name">Sort: Name</SelectItem>
                  <SelectItem value="role">Sort: Role</SelectItem>
                  <SelectItem value="project">Sort: Company</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="animate-in fade-in-0 slide-in-from-bottom-1 rounded-3xl border border-border bg-card px-4 py-3 duration-300"
            >
              <p className="text-xs font-medium text-muted-foreground">
                {metric.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {isLoading ? "-" : metric.value}
              </p>
            </div>
          ))}
        </div>

        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as FilterKey)}
          className="shrink-0"
        >
          <TabsList>
            {filterItems.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load employees</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="relative flex min-h-0 flex-1">
            <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-border bg-card">
              <ScrollArea className="min-h-0 flex-1">
                {isLoading ? (
                  <EmployeesTableSkeleton />
                ) : filteredEmployees.length > 0 ? (
                  <EmployeesTable
                    employees={filteredEmployees}
                    selectedEmployeeId={activeEmployeeId}
                    onRowOpen={openEmployeeProfile}
                  />
                ) : (
                  <EmployeesEmptyState />
                )}
              </ScrollArea>

              {!isLoading && filteredEmployees.length > 0 && (
                <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                  Showing {filteredEmployees.length} of {employees.length} employees
                </div>
              )}
            </section>

            {activeEmployeeId && (
              <EmployeeDetailPanel
                employee={selectedEmployee}
                project={selectedProject}
                isLoading={isLoading}
                onEdit={(employee) => setEditingEmployee(employee)}
                onClose={closeEmployeeProfile}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EmployeesTable({
  employees,
  selectedEmployeeId,
  onRowOpen,
}: {
  employees: Employee[]
  selectedEmployeeId?: string
  onRowOpen: (employeeId: number) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[14%]">Employee</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Current company</TableHead>
          <TableHead>Top skills</TableHead>
          <TableHead>Preferences</TableHead>
          <TableHead className="w-24 text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => {
          const isSelected = String(employee.id) === selectedEmployeeId

          return (
            <TableRow
              key={employee.id}
              data-state={isSelected ? "selected" : undefined}
              className="cursor-pointer transition-[background-color,transform] duration-150 hover:translate-x-0.5"
              onClick={() => onRowOpen(employee.id)}
            >
              <TableCell>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar>
                    <AvatarImage src={getEmployeeAvatarSrc(employee)} alt="" />
                    <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{employee.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Internal employee
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="max-w-48">
                <span className="block truncate">{employee.role}</span>
              </TableCell>
              <TableCell>
                {employee.current_project ? (
                  <Badge variant="outline">{employee.current_project}</Badge>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </TableCell>
              <TableCell>
                <SkillBadges skills={employee.skills} compact />
              </TableCell>
              <TableCell className="max-w-52">
                <span className="block truncate text-muted-foreground">
                  {employee.preferences.length > 0
                    ? employee.preferences.join(", ")
                    : "No preferences"}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  size="sm"
                  variant={isSelected ? "secondary" : "outline"}
                  onClick={(event) => {
                    event.stopPropagation()
                    onRowOpen(employee.id)
                  }}
                >
                  Open
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function EmployeeDetailPanel({
  employee,
  project,
  isLoading,
  onEdit,
  onClose,
}: {
  employee?: Employee
  project?: Project
  isLoading: boolean
  onEdit: (employee: Employee) => void
  onClose: () => void
}) {
  return (
    <aside
      className="animate-in fade-in-0 slide-in-from-right-8 z-50 flex flex-col border-l border-border bg-background shadow-xl duration-200"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(100vw, 32rem)",
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Employee detail
          </p>
          <h2 className="mt-1 font-semibold">Profile</h2>
        </div>
        <div className="flex items-center gap-2">
          {employee && (
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(employee)}>
              <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-4" />
              Edit
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close employee detail"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4 px-6 pt-5 pb-8">
          <Skeleton className="h-16" />
          <Skeleton className="h-32" />
          <Skeleton className="h-44" />
        </div>
      ) : employee ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 px-6 pt-5 pb-8">
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarImage src={getEmployeeAvatarSrc(employee)} alt="" />
                <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold">{employee.name}</h3>
                <p className="truncate text-sm text-muted-foreground">
                  {employee.role}
                </p>
                {employee.github_username ? (
                  <a
                    href={getGithubProfileUrl(employee.github_username)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex text-sm text-muted-foreground hover:text-foreground"
                  >
                    @{employee.github_username}
                  </a>
                ) : null}
              </div>
            </div>

            <Separator />

            <DetailSection title="Skill levels">
              <div className="flex flex-col gap-3">
                {skillEntries(employee.skills).map(([skill, level]) => (
                  <SkillLevel key={skill} skill={skill} level={level} />
                ))}
              </div>
            </DetailSection>

            <DetailSection title="Current allocation">
              {employee.current_project ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="font-medium">{employee.current_project}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {project?.project_description ??
                        "Company details are not available from the current API response."}
                    </p>
                  </div>
                  {project && (
                    <div className="grid grid-cols-2 gap-3">
                      <MiniStat label="Phase" value={formatPhase(project.project_phase)} />
                      <MiniStat
                        label="Team"
                        value={`${project.current_team_members.length} people`}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This employee is not assigned to a current company.
                </p>
              )}
            </DetailSection>

            <DetailSection title="Preferences and interests">
              <TokenList items={employee.preferences} emptyLabel="No preferences" />
              <TokenList items={employee.interests} emptyLabel="No interests" />
            </DetailSection>

            {project && (
              <DetailSection title="Company context">
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Required skills
                    </p>
                    <div className="mt-2">
                      <ProjectRequirementBadges
                        skills={project.required_skills}
                        compact
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Repositories
                    </p>
                    <div className="mt-2 flex flex-col gap-2">
                      {project.github_repositories.length > 0 ? (
                        project.github_repositories.map((repository) => (
                          <a
                            key={repository}
                            href={repository}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate rounded-2xl bg-muted px-3 py-2 text-sm hover:text-foreground"
                          >
                            {repository}
                          </a>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No repositories
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </DetailSection>
            )}

            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline">
                Create move request
              </Button>
              <Button type="button" variant="outline">
                Start offboarding
              </Button>
            </div>
          </div>
        </ScrollArea>
      ) : (
        <div className="px-6 pt-5 pb-8">
          <Alert>
            <AlertTitle>Employee not found</AlertTitle>
            <AlertDescription>
              The selected employee is not present in the current backend response.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </aside>
  )
}

function EmployeesTableSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-14" />
      ))}
    </div>
  )
}

function EmployeesEmptyState() {
  return (
    <div className="flex min-h-80 items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <h2 className="text-lg font-semibold">No employees found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Try adjusting the search query or selected filter.
        </p>
      </div>
    </div>
  )
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </section>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function SkillBadges({ skills, compact }: { skills: Skills; compact?: boolean }) {
  const entries = skillEntries(skills).filter(([, level]) => level > 0)
  const visibleEntries = compact ? entries.slice(0, 3) : entries

  if (visibleEntries.length === 0) {
    return <span className="text-muted-foreground">No skills</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleEntries.map(([skill, level]) => (
        <Badge key={skill} variant="secondary">
          {skillLabels[skill]} {level}
        </Badge>
      ))}
      {compact && entries.length > visibleEntries.length && (
        <Badge variant="outline">+{entries.length - visibleEntries.length}</Badge>
      )}
    </div>
  )
}

function ProjectRequirementBadges({
  skills,
  compact,
}: {
  skills: ProjectSkillRequirements
  compact?: boolean
}) {
  const entries = projectRequirementEntries(skills).filter(
    ([, requirement]) => getRequirementTotal(requirement) > 0
  )
  const visibleEntries = compact ? entries.slice(0, 3) : entries

  if (visibleEntries.length === 0) {
    return <span className="text-muted-foreground">No skills</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleEntries.map(([skill, requirement]) => (
        <Badge key={skill} variant="secondary">
          {skillLabels[skill]} {formatRequirementParts(requirement).join(", ")}
        </Badge>
      ))}
      {compact && entries.length > visibleEntries.length && (
        <Badge variant="outline">+{entries.length - visibleEntries.length}</Badge>
      )}
    </div>
  )
}

function SkillLevel({ skill, level }: { skill: SkillKey; level: number }) {
  return (
    <div className="grid grid-cols-[6rem_1fr_1.5rem] items-center gap-3">
      <span className="text-sm text-muted-foreground">{skillLabels[skill]}</span>
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-2 rounded-full",
              index < level ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>
      <span className="text-right text-sm font-medium">{level}</span>
    </div>
  )
}

function TokenList({
  items,
  emptyLabel,
}: {
  items: string[]
  emptyLabel: string
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant="outline">
          {item}
        </Badge>
      ))}
    </div>
  )
}

function skillEntries(skills: Skills): Array<[SkillKey, number]> {
  return (Object.entries(skills) as Array<[SkillKey, number]>).sort(
    ([, leftLevel], [, rightLevel]) => rightLevel - leftLevel
  )
}

function projectRequirementEntries(
  skills: ProjectSkillRequirements
): Array<[SkillKey, ProjectSkillRequirements[SkillKey]]> {
  return (
    Object.entries(skills) as Array<[SkillKey, ProjectSkillRequirements[SkillKey]]>
  ).sort(
    ([, leftRequirement], [, rightRequirement]) =>
      getRequirementTotal(rightRequirement) - getRequirementTotal(leftRequirement) ||
      getHighestRequirementLevel(rightRequirement) -
        getHighestRequirementLevel(leftRequirement)
  )
}

function formatRequirementParts(
  requirement: ProjectSkillRequirements[SkillKey]
) {
  return skillRequirementLevels
    .map((level) => {
      const count = requirement[getRequirementLevelField(level)]
      return count > 0 ? `${count}x L${level}` : null
    })
    .filter((part): part is string => Boolean(part))
}

function getRequirementLevelField(level: SkillRequirementLevel) {
  return `level_${level}` as const
}

function getRequirementTotal(requirement: ProjectSkillRequirements[SkillKey]) {
  return requirement.level_1 + requirement.level_2 + requirement.level_3
}

function getHighestRequirementLevel(requirement: ProjectSkillRequirements[SkillKey]) {
  return [...skillRequirementLevels]
    .reverse()
    .find((level) => requirement[getRequirementLevelField(level)] > 0) ?? 0
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatPhase(phase: Project["project_phase"]) {
  return phase
    .split(" ")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ")
}

function getEmployeeIdFromPath(pathname: string) {
  const match = pathname.match(/^\/cto\/employees\/([^/]+)$/)

  return match?.[1]
}
