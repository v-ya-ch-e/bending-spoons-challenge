"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Image from "next/image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { listProjects, type Project, type SkillKey, type Skills } from "@/lib/db-api"
import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
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
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

export function ProjectsScreen() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<FilterKey>("all")
  const [sort, setSort] = useState<SortKey>("name")
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const createDialogOpen = searchParams.get("create") === "1"

  useEffect(() => {
    let isMounted = true

    async function loadProjectsWorkspace() {
      try {
        setIsLoading(true)
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
            : "Unable to load project data."
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
  }, [])

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
            .filter(([, level]) => level > 0)
            .map(([skill]) => skillLabels[skill]),
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
        label: "Total projects",
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
  }

  function handleCreateDialogOpenChange(open: boolean) {
    if (open) {
      router.push("/cto/projects?create=1")
      return
    }

    router.replace(pathname)
  }

  function handleProjectCreated(project: Project) {
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
    setError(null)
    setSelectedProjectId(project.id)
    router.replace("/cto/projects")
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
      <div className="flex min-h-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage acquired products, staffing needs, required skills, and
              repositories in one place.
            </p>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <InputGroup className="w-full lg:max-w-md">
              <InputGroupAddon>
                <span>Search</span>
              </InputGroupAddon>
              <InputGroupInput
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Product, phase, skill, team member..."
                aria-label="Search projects"
              />
            </InputGroup>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Select
                value={sort}
                onValueChange={(value) => setSort(value as SortKey)}
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Sort projects"
                  className="min-w-40"
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
                  <TabsTrigger value="list">List</TabsTrigger>
                  <TabsTrigger value="cards">Cards</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
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
            <AlertTitle>Could not load projects</AlertTitle>
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

              {!isLoading && filteredProjects.length > 0 && (
                <div
                  className={cn(
                    "px-4 py-3 text-sm text-muted-foreground",
                    viewMode === "list" && "border-t border-border"
                  )}
                >
                  Showing {filteredProjects.length} of {projects.length} projects
                </div>
              )}
            </section>

            {selectedProjectId && (
              <ProjectDetailPanel
                project={selectedProject}
                isLoading={isLoading}
                onClose={closeProject}
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
          <TableHead className="w-[24%]">Project</TableHead>
          <TableHead className="w-[15%]">Phase</TableHead>
          <TableHead className="w-[25%]">Required skills</TableHead>
          <TableHead className="w-[14%]">Team</TableHead>
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
                <div className="flex min-w-0 items-center gap-2">
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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => {
        const gap = getStaffingGap(project)
        const isSelected = project.id === selectedProjectId

        return (
          <Card
            key={project.id}
            size="sm"
            className={cn(
              "animate-in fade-in-0 slide-in-from-bottom-1 cursor-pointer duration-300",
              isSelected && "ring-2 ring-ring"
            )}
            onClick={() => onProjectOpen(project.id)}
          >
            <div className="relative h-32 overflow-hidden bg-muted">
              <Image
                src={project.poster_url}
                alt=""
                width={1200}
                height={630}
                unoptimized
                className="h-full w-full object-cover opacity-90 transition-transform duration-300 group-hover/card:scale-105"
              />
            </div>
            <CardHeader>
              <CardTitle className="flex min-w-0 items-center gap-3">
                <Avatar>
                  <AvatarImage src={project.icon_url} alt="" />
                  <AvatarFallback>{getInitials(project.project_name)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 truncate">{project.project_name}</span>
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {project.project_description}
              </CardDescription>
              <CardAction>
                <PhaseBadge phase={project.project_phase} />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-1.5">
                <StaffingBadge gap={gap} />
                <Badge variant="outline">
                  {project.current_team_members.length} /{" "}
                  {project.required_people_amount} people
                </Badge>
                <Badge variant="outline">
                  {project.github_repositories.length} repos
                </Badge>
              </div>
              <SkillBadges skills={project.required_skills} compact />
              <div className="flex items-center justify-between gap-3">
                <TeamAvatars members={project.current_team_members} compact />
                <span className="text-xs text-muted-foreground">
                  {getCoveragePercent(project)}% staffed
                </span>
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button
                type="button"
                size="sm"
                variant={isSelected ? "secondary" : "outline"}
                onClick={(event) => {
                  event.stopPropagation()
                  onProjectOpen(project.id)
                }}
              >
                Open
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}

function ProjectDetailPanel({
  project,
  isLoading,
  onClose,
}: {
  project?: Project
  isLoading: boolean
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
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Project detail
          </p>
          <h2 className="mt-1 font-semibold">Company workspace</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close project detail"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4 p-4">
          <Skeleton className="h-36" />
          <Skeleton className="h-24" />
          <Skeleton className="h-44" />
        </div>
      ) : project ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 p-4">
            <div className="overflow-hidden rounded-3xl bg-muted">
              <Image
                src={project.poster_url}
                alt=""
                width={1200}
                height={630}
                unoptimized
                className="h-40 w-full object-cover"
              />
            </div>

            <div className="flex items-start gap-3">
              <Avatar size="lg">
                <AvatarImage src={project.icon_url} alt="" />
                <AvatarFallback>{getInitials(project.project_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-semibold">
                    {project.project_name}
                  </h3>
                  <PhaseBadge phase={project.project_phase} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {project.project_description}
                </p>
              </div>
            </div>

            <Separator />

            <DetailSection title="Staffing">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  label="Current team"
                  value={`${project.current_team_members.length} people`}
                />
                <MiniStat
                  label="Required team"
                  value={`${project.required_people_amount} people`}
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Coverage</span>
                  <span className="font-medium">
                    {getCoveragePercent(project)}%
                  </span>
                </div>
                <Progress value={getCoveragePercent(project)} />
                <StaffingBadge gap={getStaffingGap(project)} />
              </div>
            </DetailSection>

            <DetailSection title="Required skills">
              <div className="flex flex-col gap-3">
                {skillEntries(project.required_skills).map(([skill, level]) => (
                  <SkillLevel key={skill} skill={skill} level={level} />
                ))}
              </div>
            </DetailSection>

            <DetailSection title="Current team">
              {project.current_team_members.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {project.current_team_members.map((member) => (
                    <div
                      key={member}
                      className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2"
                    >
                      <Avatar size="sm">
                        <AvatarFallback>{getInitials(member)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 truncate text-sm font-medium">
                        {member}
                      </span>
                    </div>
                  ))}
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
                      className="truncate rounded-2xl bg-muted px-3 py-2 text-sm hover:text-foreground"
                    >
                      {repository}
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
        <div className="p-4">
          <Alert>
            <AlertTitle>Project not found</AlertTitle>
            <AlertDescription>
              The selected project is not present in the current backend response.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </aside>
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
        <h2 className="text-lg font-semibold">No projects found</h2>
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
  children: ReactNode
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
  members: string[]
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
        <Avatar key={member} size="sm">
          <AvatarFallback>{getInitials(member)}</AvatarFallback>
        </Avatar>
      ))}
      {hiddenCount > 0 && <AvatarGroupCount>+{hiddenCount}</AvatarGroupCount>}
    </AvatarGroup>
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

function skillEntries(skills: Skills): Array<[SkillKey, number]> {
  return (Object.entries(skills) as Array<[SkillKey, number]>).sort(
    ([, leftLevel], [, rightLevel]) => rightLevel - leftLevel
  )
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
