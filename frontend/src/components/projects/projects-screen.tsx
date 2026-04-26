"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowRight01Icon,
  Cancel01Icon,
  Edit02Icon,
  GridViewIcon,
  InformationCircleIcon,
  ListViewIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  getGithubProfileUrl,
  getCachedEmployees,
  getCachedProjects,
  listEmployees,
  listProjects,
  type Employee,
  type Project,
  type ProjectSkillRequirement,
  type ProjectSkillRequirements,
  type SkillKey,
} from "@/lib/db-api"
import type { ProjectsInitialData } from "@/lib/server/db-api"
import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Progress } from "@/components/ui/progress"
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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

type FilterKey =
  | "all"
  | "new acquisition"
  | "growth"
  | "maintenance"
  | "needs-staffing"
type SortKey = "name" | "phase" | "team" | "gap"
type ViewMode = "list" | "cards"

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

const tooltipPlannedHeadcount =
  "Planned headcount is the minimum number of distinct people implied by staffing roles (from extraction or your edits). It is not the sum of every per-skill line below: one engineer can satisfy several skill dimensions, so overlap is normal."

const tooltipCurrentTeam =
  "People currently assigned to this company in internal records. Coverage compares this count to planned headcount."

const tooltipCoverage =
  "Coverage is current team size divided by planned headcount. It does not check each per-skill row separately — only how many assigned people you have versus the planned minimum team."

const tooltipSkillDimensionsBadge =
  "Counts how many skill columns (Android, iOS, Web, Backend, Infra, AI) have at least one non-zero requirement. That is breadth across skills, not how many people you need."

const tooltipSkillDistributionTitle =
  "Each row is a per-skill staffing profile: how many engineers need at least L1, L2, or L3 in that area. The same hire can contribute to multiple rows."

const tooltipSlotVsHeadcountSubnote =
  "Per-skill totals are coverage slots per dimension. One hire can cover several skills at once, so row totals often exceed planned headcount while headcount stays the distinct minimum team."

const filterItems: Array<{
  value: FilterKey
  label: string
}> = [
  { value: "all", label: "All" },
  { value: "new acquisition", label: "New acquisition" },
  { value: "growth", label: "Growth" },
  { value: "maintenance", label: "Maintenance" },
  { value: "needs-staffing", label: "Needs staffing" },
]

export function ProjectsScreen({
  initialData,
}: {
  initialData?: ProjectsInitialData | null
}) {
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
  const [viewMode, setViewMode] = useState<ViewMode>("cards")
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>()
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | undefined>()
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isEmployeeLoading, setIsEmployeeLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(() => !initialData && !cachedProjects)
  const [employeeError, setEmployeeError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const createDialogOpen = searchParams.get("create") === "1"

  useEffect(() => {
    if (initialData) {
      return
    }

    let isMounted = true

    async function loadProjectsWorkspace() {
      try {
        if (!getCachedProjects()) {
          setIsLoading(true)
        }
        setError(null)
        const nextProjects = await listProjects()

        if (!isMounted) {
          return
        }

        setProjects(nextProjects)
      } catch (loadError) {
        if (!isMounted) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load company data."
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadProjectsWorkspace()

    return () => {
      isMounted = false
    }
  }, [initialData])

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()

    return projects
      .filter((project) => {
        if (filter === "needs-staffing" && getStaffingGap(project) === 0) {
          return false
        }

        if (
          filter !== "all" &&
          filter !== "needs-staffing" &&
          project.project_phase !== filter
        ) {
          return false
        }

        if (!normalizedSearch) {
          return true
        }

        const searchableText = [
          project.project_name,
          project.project_description,
          project.project_phase,
          ...project.current_team_members,
          ...project.github_repositories,
          ...skillEntries(project.required_skills)
            .filter(([, requirement]) => getRequirementTotal(requirement) > 0)
            .map(([skill, requirement]) =>
              `${skillLabels[skill]} ${formatRequirementParts(requirement).join(" ")}`
            ),
        ]
          .join(" ")
          .toLowerCase()

        return searchableText.includes(normalizedSearch)
      })
      .sort((leftProject, rightProject) => {
        if (sort === "phase") {
          return leftProject.project_phase.localeCompare(rightProject.project_phase)
        }

        if (sort === "team") {
          return (
            rightProject.current_team_members.length -
            leftProject.current_team_members.length
          )
        }

        if (sort === "gap") {
          return getStaffingGap(rightProject) - getStaffingGap(leftProject)
        }

        return leftProject.project_name.localeCompare(rightProject.project_name)
      })
  }, [filter, projects, searchQuery, sort])

  const selectedProject = useMemo(() => {
    return projects.find((project) => project.id === selectedProjectId)
  }, [projects, selectedProjectId])

  const selectedEmployee = useMemo(() => {
    return employees.find((employee) => employee.id === selectedEmployeeId)
  }, [employees, selectedEmployeeId])

  const selectedEmployeeProject = selectedEmployee?.current_project
    ? projects.find((project) => project.project_name === selectedEmployee.current_project)
    : undefined

  const metrics = useMemo(() => {
    const projectsNeedingStaff = projects.filter(
      (project) => getStaffingGap(project) > 0
    ).length
    const repositoryCount = projects.reduce(
      (total, project) => total + project.github_repositories.length,
      0
    )

    return [
      {
        label: "Total companies",
        value: projects.length,
      },
      {
        label: "New acquisitions",
        value: projects.filter(
          (project) => project.project_phase === "new acquisition"
        ).length,
      },
      {
        label: "Need staffing",
        value: projectsNeedingStaff,
      },
      {
        label: "Repositories",
        value: repositoryCount,
      },
    ]
  }, [projects])

  function openProject(projectId: number) {
    setSelectedProjectId(projectId)
  }

  function closeProject() {
    setSelectedProjectId(undefined)
    setSelectedEmployeeId(undefined)
  }

  async function openEmployeeDetail(employeeId: number) {
    setSelectedEmployeeId(employeeId)
    setEmployeeError(null)

    if (employees.some((employee) => employee.id === employeeId)) {
      return
    }

    try {
      setIsEmployeeLoading(true)
      const nextEmployees = await listEmployees()
      setEmployees(nextEmployees)
    } catch (loadError) {
      setEmployeeError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load employee details."
      )
    } finally {
      setIsEmployeeLoading(false)
    }
  }

  function closeEmployeeDetail() {
    setSelectedEmployeeId(undefined)
    setEmployeeError(null)
  }

  function handleCreateDialogOpenChange(open: boolean) {
    if (open) {
      router.push("/cto/projects?create=1")
      return
    }

    router.replace(pathname)
  }

  function handleProjectCreated(project: Project) {
    upsertProject(project)
    setError(null)
    setSelectedProjectId(project.id)
    router.replace("/cto/projects")
  }

  function handleProjectSaved(project: Project) {
    upsertProject(project)
    setError(null)
    setEditingProject(null)
    setSelectedProjectId(project.id)
  }

  function upsertProject(project: Project) {
    setProjects((currentProjects) => {
      const exists = currentProjects.some(
        (currentProject) => currentProject.id === project.id
      )

      if (exists) {
        return currentProjects.map((currentProject) =>
          currentProject.id === project.id ? project : currentProject
        )
      }

      return [...currentProjects, project]
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {createDialogOpen && (
        <CreateProjectDialog
          open={createDialogOpen}
          onOpenChange={handleCreateDialogOpenChange}
          onCreated={handleProjectCreated}
        />
      )}
      {editingProject && (
        <CreateProjectDialog
          open={Boolean(editingProject)}
          mode="edit"
          project={editingProject}
          onOpenChange={(open) => {
            if (!open) {
              setEditingProject(null)
            }
          }}
          onCreated={handleProjectSaved}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage acquired companies, staffing needs, required skills, and
              repositories in one place.
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
                placeholder="Company, phase, skill, team..."
                aria-label="Search companies"
              />
            </InputGroup>

            <Select
              value={sort}
              onValueChange={(value) => setSort(value as SortKey)}
            >
              <SelectTrigger
                size="sm"
                aria-label="Sort companies"
                className="min-w-36"
              >
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="name">Sort: Name</SelectItem>
                  <SelectItem value="phase">Sort: Phase</SelectItem>
                  <SelectItem value="team">Sort: Team size</SelectItem>
                  <SelectItem value="gap">Sort: Staffing gap</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Tabs
              value={viewMode}
              onValueChange={(value) => setViewMode(value as ViewMode)}
              className="shrink-0"
            >
              <TabsList>
                <TabsTrigger
                  value="list"
                  aria-label="List view"
                  className="px-3"
                >
                  <HugeiconsIcon icon={ListViewIcon} strokeWidth={2} className="size-4" />
                </TabsTrigger>
                <TabsTrigger
                  value="cards"
                  aria-label="Grid view"
                  className="px-3"
                >
                  <HugeiconsIcon icon={GridViewIcon} strokeWidth={2} className="size-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
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

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as FilterKey)}
          >
            <TabsList>
              {filterItems.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {!isLoading && filteredProjects.length > 0 && (
            <span className="shrink-0 text-sm text-muted-foreground">
              Showing {filteredProjects.length} of {projects.length} companies
            </span>
          )}
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load companies</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="relative flex min-h-0 flex-1">
            <section
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col",
                viewMode === "list" &&
                  "overflow-hidden rounded-3xl border border-border bg-card"
              )}
            >
              <ScrollArea className="min-h-0 flex-1">
                {isLoading ? (
                  <ProjectsTableSkeleton />
                ) : filteredProjects.length > 0 ? (
                  viewMode === "list" ? (
                    <ProjectsTable
                      projects={filteredProjects}
                      selectedProjectId={selectedProjectId}
                      onRowOpen={openProject}
                    />
                  ) : (
                    <ProjectsCardGrid
                      projects={filteredProjects}
                      selectedProjectId={selectedProjectId}
                      onProjectOpen={openProject}
                    />
                  )
                ) : (
                  <ProjectsEmptyState />
                )}
              </ScrollArea>
            </section>

            {selectedProjectId && (
              <ProjectDetailPanel
                project={selectedProject}
                isLoading={isLoading}
                onEmployeeOpen={openEmployeeDetail}
                onEdit={(project) => setEditingProject(project)}
                onClose={closeProject}
              />
            )}
            {selectedEmployeeId && (
              <ProjectEmployeeDetailPanel
                employee={selectedEmployee}
                project={selectedEmployeeProject}
                isLoading={isEmployeeLoading}
                error={employeeError}
                onClose={closeEmployeeDetail}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectsTable({
  projects,
  selectedProjectId,
  onRowOpen,
}: {
  projects: Project[]
  selectedProjectId?: number
  onRowOpen: (projectId: number) => void
}) {
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[20%]">Company</TableHead>
          <TableHead className="w-[14%]">Phase</TableHead>
          <TableHead className="w-[24%]">Required skills</TableHead>
          <TableHead className="w-[20%]">Team</TableHead>
          <TableHead className="w-[13%]">Staffing</TableHead>
          <TableHead className="w-[9%] text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => {
          const isSelected = project.id === selectedProjectId
          const gap = getStaffingGap(project)

          return (
            <TableRow
              key={project.id}
              data-state={isSelected ? "selected" : undefined}
              className="cursor-pointer transition-[background-color,transform] duration-150 hover:translate-x-0.5"
              onClick={() => onRowOpen(project.id)}
            >
              <TableCell className="min-w-0">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar>
                    <AvatarImage src={project.icon_url} alt="" />
                    <AvatarFallback>{getInitials(project.project_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{project.project_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {project.github_repositories.length} repositories
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="min-w-0">
                <PhaseBadge phase={project.project_phase} />
              </TableCell>
              <TableCell className="min-w-0 whitespace-normal">
                <SkillBadges skills={project.required_skills} compact />
              </TableCell>
              <TableCell className="min-w-0">
                <div className="flex min-w-0 items-center gap-3">
                  <TeamAvatars
                    members={project.current_team_members.map((member, index) => ({
                      name: member,
                      id: project.current_team_member_ids[index],
                    }))}
                    compact
                  />
                  <span className="text-sm text-muted-foreground">
                    {project.current_team_members.length} /{" "}
                    {project.required_people_amount}
                  </span>
                </div>
              </TableCell>
              <TableCell className="min-w-0">
                <StaffingBadge gap={gap} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  size="sm"
                  variant={isSelected ? "secondary" : "outline"}
                  onClick={(event) => {
                    event.stopPropagation()
                    onRowOpen(project.id)
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

function ProjectsCardGrid({
  projects,
  selectedProjectId,
  onProjectOpen,
}: {
  projects: Project[]
  selectedProjectId?: number
  onProjectOpen: (projectId: number) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => {
        const gap = getStaffingGap(project)
        const isSelected = project.id === selectedProjectId

        return (
          <Card
            key={project.id}
            size="sm"
            className={cn(
              "animate-in fade-in-0 slide-in-from-bottom-1 cursor-pointer gap-3 rounded-3xl border border-border/70 bg-card shadow-none ring-0 transition-colors duration-300 hover:border-border hover:bg-accent/30",
              isSelected && "border-primary/50 bg-accent/40"
            )}
            onClick={() => onProjectOpen(project.id)}
          >
            <CardHeader className="gap-2 pb-0">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="flex min-w-0 items-center gap-2.5 text-base">
                  <Avatar size="sm">
                    <AvatarImage src={project.icon_url} alt="" />
                    <AvatarFallback>{getInitials(project.project_name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate">{project.project_name}</span>
                </CardTitle>
                <PhaseBadge phase={project.project_phase} />
              </div>
              <CardDescription className="line-clamp-2 text-xs leading-5">
                {project.project_description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  <StaffingBadge gap={gap} />
                  <Badge variant="outline">
                    {project.current_team_members.length}/
                    {project.required_people_amount} people
                  </Badge>
                  <Badge variant="outline">
                    {project.github_repositories.length} repos
                  </Badge>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {getCoveragePercent(project)}%
                </span>
              </div>
              <SkillBadges skills={project.required_skills} compact />
              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                <TeamAvatars
                  members={project.current_team_members.map((member, index) => ({
                    name: member,
                    id: project.current_team_member_ids[index],
                  }))}
                  compact
                />
                <Button
                  type="button"
                  size="xs"
                  variant={isSelected ? "secondary" : "ghost"}
                  onClick={(event) => {
                    event.stopPropagation()
                    onProjectOpen(project.id)
                  }}
                >
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function ProjectDetailPanel({
  project,
  isLoading,
  onEmployeeOpen,
  onEdit,
  onClose,
}: {
  project?: Project
  isLoading: boolean
  onEmployeeOpen: (employeeId: number) => void
  onEdit: (project: Project) => void
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
        width: "min(100vw, 34rem)",
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Company detail
          </p>
          <h2 className="mt-1 font-semibold">Company workspace</h2>
        </div>
        <div className="flex items-center gap-2">
          {project && (
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(project)}>
              <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-4" />
              Edit
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close company detail"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4 px-6 pt-5 pb-8">
          <Skeleton className="h-36" />
          <Skeleton className="h-24" />
          <Skeleton className="h-44" />
        </div>
      ) : project ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 px-6 pt-5 pb-8">
            <ProjectCover project={project} />

            <DetailSection title="Staffing">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  label="Current team"
                  value={`${project.current_team_members.length} people`}
                  labelTooltip={tooltipCurrentTeam}
                />
                <MiniStat
                  label="Planned headcount"
                  value={`${project.required_people_amount} people`}
                  labelTooltip={tooltipPlannedHeadcount}
                />
              </div>
              {getTotalSkillSlotCount(project.required_skills) >
                project.required_people_amount && (
                <div className="flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
                  <span className="min-w-0">
                    <span className="font-medium text-foreground/80">Note</span>
                    {": Per-skill totals can exceed headcount when roles overlap."}{" "}
                    <InfoTooltip content={tooltipSlotVsHeadcountSubnote} side="right" />
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    Coverage
                    <InfoTooltip content={tooltipCoverage} side="top" />
                  </span>
                  <span className="font-medium">
                    {getCoveragePercent(project)}%
                  </span>
                </div>
                <Progress value={getCoveragePercent(project)} />
                <StaffingBadge gap={getStaffingGap(project)} />
              </div>
            </DetailSection>

            <RequiredSkillsDistribution skills={project.required_skills} />

            <DetailSection title="Current team">
              {project.current_team_members.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {project.current_team_members.map((member, index) => {
                    const employeeId = project.current_team_member_ids[index]

                    return (
                      <button
                        type="button"
                        key={`${member}-${employeeId ?? index}`}
                        disabled={!employeeId}
                        onClick={() => {
                          if (employeeId) {
                            onEmployeeOpen(employeeId)
                          }
                        }}
                        className="group flex items-center gap-3 rounded-2xl bg-muted px-3 py-2 text-left transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Avatar size="sm">
                          <AvatarImage
                            src={getEmployeeAvatarSrc(
                              employeeId ? { id: employeeId, name: member } : { name: member }
                            )}
                            alt=""
                          />
                          <AvatarFallback>{getInitials(member)}</AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 truncate text-sm font-medium">
                          {member}
                        </span>
                        <span
                          className="ml-auto grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors group-hover:bg-background group-hover:text-foreground"
                          aria-hidden="true"
                        >
                          <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            strokeWidth={2}
                            className="size-4"
                          />
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No team members are assigned to this project.
                </p>
              )}
            </DetailSection>

            <DetailSection title="Repositories">
              {project.github_repositories.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {project.github_repositories.map((repository) => (
                    <a
                      key={repository}
                      href={repository}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-3 rounded-2xl bg-muted px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <span className="min-w-0 flex-1 truncate">{repository}</span>
                      <span
                        className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors group-hover:bg-background group-hover:text-foreground"
                        aria-hidden="true"
                      >
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          strokeWidth={2}
                          className="size-4"
                        />
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No repositories</p>
              )}
            </DetailSection>
          </div>
        </ScrollArea>
      ) : (
        <div className="px-6 pt-5 pb-8">
          <Alert>
            <AlertTitle>Company not found</AlertTitle>
            <AlertDescription>
              The selected company is not present in the current backend response.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </aside>
  )
}

function ProjectCover({ project }: { project: Project }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-background p-5">
      <DotPattern className="absolute right-0 bottom-0 size-44 text-muted-foreground/25 [mask-image:radial-gradient(circle_at_bottom_right,black,transparent_72%)]" />
      <div className="relative flex h-32 flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <Avatar size="lg" className="bg-background shadow-sm ring-1 ring-border">
            <AvatarImage src={project.icon_url} alt="" />
            <AvatarFallback>{getInitials(project.project_name)}</AvatarFallback>
          </Avatar>
          <PhaseBadge phase={project.project_phase} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{project.project_name}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {project.project_description}
          </p>
        </div>
      </div>
    </div>
  )
}

function ProjectEmployeeDetailPanel({
  employee,
  project,
  isLoading,
  error,
  onClose,
}: {
  employee?: Employee
  project?: Project
  isLoading: boolean
  error: string | null
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

      {isLoading ? (
        <div className="flex flex-col gap-4 px-6 pt-5 pb-8">
          <Skeleton className="h-16" />
          <Skeleton className="h-32" />
          <Skeleton className="h-44" />
        </div>
      ) : error ? (
        <div className="px-6 pt-5 pb-8">
          <Alert variant="destructive">
            <AlertTitle>Could not load employee</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
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
                {employeeSkillEntries(employee.skills).map(([skill, level]) => (
                  <EmployeeSkillLevel key={skill} skill={skill} level={level} />
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

function DotPattern({ className }: { className?: string }) {
  const dots = Array.from({ length: 64 }, (_, index) => {
    const columns = 8
    const x = (index % columns) * 16 + 4
    const y = Math.floor(index / columns) * 16 + 4

    return <circle key={index} cx={x} cy={y} r="1.4" fill="currentColor" />
  })

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 128 128"
      className={cn("pointer-events-none", className)}
    >
      {dots}
    </svg>
  )
}

function ProjectsTableSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-14" />
      ))}
    </div>
  )
}

function ProjectsEmptyState() {
  return (
    <div className="flex min-h-80 items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <h2 className="text-lg font-semibold">No companies found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Try adjusting the search query or selected filter.
        </p>
      </div>
    </div>
  )
}

function RequiredSkillsDistribution({
  skills,
}: {
  skills: ProjectSkillRequirements
}) {
  const requiredSkillsCount = skillEntries(skills).filter(
    ([, requirement]) => getRequirementTotal(requirement) > 0
  ).length

  return (
    <DetailSection title="Required skills">
      <Accordion type="single" collapsible defaultValue="skills">
        <AccordionItem value="skills">
          <AccordionTrigger>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="cursor-help border-b border-dotted border-muted-foreground/40 decoration-muted-foreground/50"
                  title={tooltipSkillDistributionTitle}
                >
                  Skill distribution
                </span>
                <Badge
                  variant="outline"
                  title={tooltipSkillDimensionsBadge}
                  className="cursor-help"
                >
                  {requiredSkillsCount}{" "}
                  {requiredSkillsCount === 1 ? "skill" : "skills"}
                </Badge>
              </div>
              <div className="mt-2">
                <SkillBadges skills={skills} compact />
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="mb-3 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
              <span className="min-w-0">
                <span className="font-medium text-foreground/80">Note</span>
                {": Rows are per-skill minimum levels (L1–L3 counts), not additive team size."}{" "}
                <InfoTooltip content={tooltipSlotVsHeadcountSubnote} side="right" />
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {skillEntries(skills).map(([skill, requirement]) => (
                <SkillLevel key={skill} skill={skill} requirement={requirement} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </DetailSection>
  )
}

function InfoTooltip({
  content,
  side = "top",
}: {
  content: string
  side?: "top" | "right" | "bottom" | "left"
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="More information"
        >
          <HugeiconsIcon
            icon={InformationCircleIcon}
            strokeWidth={2}
            className="size-3.5"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={6}
        className="max-w-sm text-pretty font-normal leading-snug"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </section>
  )
}

function MiniStat({
  label,
  value,
  labelTooltip,
}: {
  label: string
  value: string
  labelTooltip?: string
}) {
  return (
    <div className="rounded-2xl bg-muted px-3 py-2">
      <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        <span className="min-w-0 shrink">{label}</span>
        {labelTooltip ? (
          <InfoTooltip content={labelTooltip} side="top" />
        ) : null}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function PhaseBadge({ phase }: { phase: Project["project_phase"] }) {
  return <Badge variant="outline">{formatPhase(phase)}</Badge>
}

function StaffingBadge({ gap }: { gap: number }) {
  if (gap > 0) {
    return <Badge variant="destructive">Needs {gap}</Badge>
  }

  return <Badge variant="secondary">Fully staffed</Badge>
}

function TeamAvatars({
  members,
  compact,
}: {
  members: Array<{ name: string; id?: number }>
  compact?: boolean
}) {
  const visibleMembers = compact ? members.slice(0, 3) : members
  const hiddenCount = members.length - visibleMembers.length

  if (members.length === 0) {
    return <span className="text-sm text-muted-foreground">No team</span>
  }

  return (
    <AvatarGroup>
      {visibleMembers.map((member) => (
        <Avatar key={member.id ?? member.name} size="sm">
          <AvatarImage
            src={getEmployeeAvatarSrc(
              member.id ? { id: member.id, name: member.name } : { name: member.name }
            )}
            alt=""
          />
          <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
        </Avatar>
      ))}
      {hiddenCount > 0 && <AvatarGroupCount>+{hiddenCount}</AvatarGroupCount>}
    </AvatarGroup>
  )
}

function SkillBadges({
  skills,
  compact,
}: {
  skills: ProjectSkillRequirements
  compact?: boolean
}) {
  const entries = skillEntries(skills).filter(
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
          {formatRequirementBadge(skill, requirement)}
        </Badge>
      ))}
      {compact && entries.length > visibleEntries.length && (
        <Badge variant="outline">+{entries.length - visibleEntries.length}</Badge>
      )}
    </div>
  )
}

function SkillLevel({
  skill,
  requirement,
}: {
  skill: SkillKey
  requirement: ProjectSkillRequirement
}) {
  const hasCount = getRequirementTotal(requirement) > 0

  return (
    <div className="grid grid-cols-[6rem_12rem_minmax(0,1fr)] items-center gap-3">
      <span className="text-sm text-muted-foreground">{skillLabels[skill]}</span>
      <div className="grid grid-cols-3 gap-1.5">
        {skillRequirementLevels.map((level) => (
          <span
            key={level}
            className={cn(
              "h-2 rounded-full",
              requirement[getRequirementLevelField(level)] > 0
                ? "bg-primary"
                : "bg-muted"
            )}
          />
        ))}
      </div>
      <span
        className={cn(
          "text-right text-sm font-medium",
          !hasCount && "text-muted-foreground"
        )}
      >
        {hasCount ? formatRequirementParts(requirement).join(", ") : "0x"}
      </span>
    </div>
  )
}

function EmployeeSkillLevel({
  skill,
  level,
}: {
  skill: SkillKey
  level: number
}) {
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

function skillEntries(
  skills: ProjectSkillRequirements
): Array<[SkillKey, ProjectSkillRequirement]> {
  return (
    Object.entries(skills) as Array<[SkillKey, ProjectSkillRequirement]>
  ).sort(
    ([, leftRequirement], [, rightRequirement]) =>
      getRequirementTotal(rightRequirement) - getRequirementTotal(leftRequirement) ||
      getHighestRequirementLevel(rightRequirement) -
        getHighestRequirementLevel(leftRequirement)
  )
}

function employeeSkillEntries(
  skills: Employee["skills"]
): Array<[SkillKey, number]> {
  return (Object.entries(skills) as Array<[SkillKey, number]>).sort(
    ([, leftLevel], [, rightLevel]) => rightLevel - leftLevel
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

function formatRequirementBadge(
  skill: SkillKey,
  requirement: ProjectSkillRequirement
) {
  return `${skillLabels[skill]} ${formatRequirementParts(requirement).join(", ")}`
}

function formatRequirementParts(requirement: ProjectSkillRequirement) {
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

function getRequirementTotal(requirement: ProjectSkillRequirement) {
  return requirement.level_1 + requirement.level_2 + requirement.level_3
}

function getTotalSkillSlotCount(skills: ProjectSkillRequirements) {
  return (Object.keys(skillLabels) as SkillKey[]).reduce(
    (sum, skill) => sum + getRequirementTotal(skills[skill]),
    0
  )
}

function getHighestRequirementLevel(requirement: ProjectSkillRequirement) {
  return [...skillRequirementLevels]
    .reverse()
    .find((level) => requirement[getRequirementLevelField(level)] > 0) ?? 0
}

function getStaffingGap(project: Project) {
  return Math.max(
    project.required_people_amount - project.current_team_members.length,
    0
  )
}

function getCoveragePercent(project: Project) {
  if (project.required_people_amount === 0) {
    return 100
  }

  return Math.min(
    Math.round(
      (project.current_team_members.length / project.required_people_amount) * 100
    ),
    100
  )
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
