"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  BookOpen01Icon,
  Briefcase01Icon,
  CheckListIcon,
  Task01Icon,
} from "@hugeicons/core-free-icons"

import {
  getCachedProjects,
  listProjectDocumentation,
  listProjects,
  type Employee,
  type Project,
  type ProjectDocumentation,
  type ProjectSkillRequirement,
  type SkillKey,
} from "@/lib/db-api"
import {
  DocumentationStatusBadge,
  ProjectDocumentationChat,
  ProjectDocumentationViewer,
  formatGeneratedAt,
  indexDocumentation,
} from "@/components/documentation/project-documentation-panel"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type EmployeeMyProjectScreenProps = {
  employee: Employee
}

const skillKeys: SkillKey[] = [
  "android",
  "ios",
  "web",
  "backend",
  "infrastructure",
  "ai",
]

const skillLabels: Record<SkillKey, string> = {
  android: "Android",
  ios: "iOS",
  web: "Web",
  backend: "Backend",
  infrastructure: "Infra",
  ai: "AI",
}

const chatPrompts = [
  "What should I read first?",
  "Summarize the architecture for my role.",
  "Which repositories should I pay attention to?",
  "What are the likely onboarding risks?",
]

export function EmployeeMyProjectScreen({ employee }: EmployeeMyProjectScreenProps) {
  const cachedProjects = getCachedProjects()
  const [projects, setProjects] = useState<Project[]>(() => cachedProjects ?? [])
  const [documentationByProject, setDocumentationByProject] = useState<
    Record<number, ProjectDocumentation | undefined>
  >({})
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(() => !cachedProjects)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadProjects() {
      try {
        if (!getCachedProjects()) {
          setIsLoading(true)
        }
        setError(null)
        const [nextProjects, documentation] = await Promise.all([
          listProjects(),
          listProjectDocumentation().catch(() => []),
        ])

        if (!isMounted) {
          return
        }

        setProjects(nextProjects)
        setDocumentationByProject(indexDocumentation(documentation))
        setSelectedProjectId((currentProjectId) => {
          const nextAssignedProjects = getAssignedProjects(employee, nextProjects)
          if (
            currentProjectId &&
            nextAssignedProjects.some((project) => project.id === currentProjectId)
          ) {
            return currentProjectId
          }
          return nextAssignedProjects[0]?.id ?? null
        })
      } catch (loadError) {
        if (!isMounted) {
          return
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load assigned companies."
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadProjects()

    return () => {
      isMounted = false
    }
  }, [employee])

  const assignedProjects = useMemo(
    () => getAssignedProjects(employee, projects),
    [employee, projects]
  )
  const activeSelectedProjectId =
    selectedProjectId &&
    assignedProjects.some((project) => project.id === selectedProjectId)
      ? selectedProjectId
      : assignedProjects[0]?.id ?? null
  const selectedProject = useMemo(() => {
    return assignedProjects.find((project) => project.id === activeSelectedProjectId)
  }, [activeSelectedProjectId, assignedProjects])
  const selectedDocumentation = selectedProject
    ? documentationByProject[selectedProject.id]
    : undefined
  const documentationMarkdown = selectedDocumentation?.content_markdown ?? ""
  const readyDocumentationCount = assignedProjects.filter(
    (project) => documentationByProject[project.id]?.status === "ready"
  ).length

  return (
    <div className="min-h-full bg-background">
      <div className="flex flex-col gap-5 p-4 sm:p-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm text-muted-foreground">Employee workspace</p>
            <h1 className="text-2xl font-semibold tracking-tight">My Companies</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Assigned projects, source documentation, and project-specific guidance
              for {employee.name}.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[26rem]">
            <Metric label="Assigned" value={isLoading ? "-" : assignedProjects.length} />
            <Metric
              label="Docs ready"
              value={isLoading ? "-" : readyDocumentationCount}
            />
            <Metric label="Role" value={employee.role} compact />
          </div>
        </header>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load My Companies</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <EmployeeMyProjectLoadingState />
        ) : !assignedProjects.length ? (
          <EmptyAssignedProjects employee={employee} />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="h-fit xl:sticky xl:top-6">
              <CardHeader>
                <CardTitle>Assigned companies</CardTitle>
                <CardDescription>
                  Switch between every project currently linked to you.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[calc(100vh-16rem)] pr-3">
                  <div className="space-y-2">
                    {assignedProjects.map((project) => (
                      <AssignedProjectButton
                        key={project.id}
                        project={project}
                        documentation={documentationByProject[project.id]}
                        selected={selectedProject?.id === project.id}
                        onSelect={() => setSelectedProjectId(project.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              {selectedProject ? (
                <ProjectInformationCard
                  employee={employee}
                  project={selectedProject}
                />
              ) : null}

              <Tabs defaultValue="documentation" className="gap-4">
                <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="px-1">
                    <p className="text-sm font-medium">Company knowledge</p>
                    <p className="text-xs text-muted-foreground">
                      Switch between full documentation and the interactive assistant.
                    </p>
                  </div>
                  <TabsList>
                    <TabsTrigger value="documentation">Documentation</TabsTrigger>
                    <TabsTrigger value="chat">Chat</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="documentation" className="mt-0">
                  <Card className="min-h-[32rem]">
                    <CardHeader className="gap-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle>Documentation</CardTitle>
                            {selectedDocumentation ? (
                              <DocumentationStatusBadge status={selectedDocumentation.status} />
                            ) : (
                              <Badge variant="outline">No docs</Badge>
                            )}
                          </div>
                          <CardDescription>
                            {selectedDocumentation
                              ? formatGeneratedAt(selectedDocumentation)
                              : "No generated documentation has been stored yet."}
                          </CardDescription>
                        </div>
                        <Button type="button" variant="outline" size="sm" asChild>
                          <Link href={`/spooner/${employee.id}/onboarding`}>
                            <HugeiconsIcon icon={CheckListIcon} className="size-4" />
                            Onboarding
                          </Link>
                        </Button>
                      </div>
                      {selectedProject ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedProject.github_repositories.map((repo) => (
                            <Badge key={repo} variant="secondary" className="max-w-full truncate">
                              {repo}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </CardHeader>
                    <CardContent className="min-h-[24rem]">
                      <ProjectDocumentationViewer
                        project={selectedProject}
                        documentation={selectedDocumentation}
                        markdown={documentationMarkdown}
                        noDocumentationDescription="Generated docs are not ready yet. Ask your CTO to fetch documentation from GitHub."
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="chat" className="mt-0">
                  <ProjectDocumentationChat
                    project={selectedProject}
                    documentation={selectedDocumentation}
                    starterPrompts={chatPrompts}
                    description="Ask about this company's docs from your employee perspective."
                    className="min-h-[32rem]"
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AssignedProjectButton({
  project,
  documentation,
  selected,
  onSelect,
}: {
  project: Project
  documentation?: ProjectDocumentation
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-3xl border p-3 text-left transition-colors",
        selected
          ? "border-primary/40 bg-primary/10"
          : "border-border hover:bg-muted/60"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{project.project_name}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {project.project_description}
          </p>
        </div>
        {documentation ? (
          <DocumentationStatusBadge status={documentation.status} />
        ) : (
          <Badge variant="outline">No docs</Badge>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{formatPhase(project.project_phase)}</span>
        <span>
          {project.github_repositories.length} repo
          {project.github_repositories.length === 1 ? "" : "s"}
        </span>
      </div>
    </button>
  )
}

function ProjectInformationCard({
  employee,
  project,
}: {
  employee: Employee
  project: Project
}) {
  const staffingGap = getStaffingGap(project)

  return (
    <Card className="shrink-0">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <Avatar size="lg" className="bg-background shadow-sm ring-1 ring-border">
              <AvatarImage src={project.icon_url} alt="" />
              <AvatarFallback>{getInitials(project.project_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{project.project_name}</CardTitle>
                <PhaseBadge phase={project.project_phase} />
              </div>
              <CardDescription className="mt-1 line-clamp-2">
                {project.project_description}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/spooner/${employee.id}/offboarding`}>
                <HugeiconsIcon icon={Task01Icon} className="size-4" />
                Offboarding
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/spooner/${employee.id}/resources`}>
                <HugeiconsIcon icon={BookOpen01Icon} className="size-4" />
                Resources
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat
                label="Current team"
                value={`${project.current_team_members.length} people`}
              />
              <MiniStat
                label="Planned"
                value={`${project.required_people_amount} people`}
              />
              <MiniStat
                label="Staffing"
                value={staffingGap > 0 ? `${staffingGap} open` : "Covered"}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Team coverage</span>
                <span className="font-medium">{getCoveragePercent(project)}%</span>
              </div>
              <Progress value={getCoveragePercent(project)} />
            </div>
            <Separator />
            <ProjectLinks project={project} />
          </div>

          <div className="space-y-4">
            <SkillFitCard employee={employee} project={project} />
            <TeamCard project={project} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ProjectLinks({ project }: { project: Project }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <p className="mb-2 text-sm font-medium">Repositories</p>
        {project.github_repositories.length ? (
          <div className="space-y-2">
            {project.github_repositories.slice(0, 3).map((repository) => (
              <a
                key={repository}
                href={repository}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground"
              >
                <span className="min-w-0 flex-1 truncate">{repository}</span>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                />
              </a>
            ))}
            {project.github_repositories.length > 3 ? (
              <p className="text-xs text-muted-foreground">
                +{project.github_repositories.length - 3} more repositories in documentation.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
            No repositories connected.
          </p>
        )}
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Company focus</p>
        <div className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
          <p>
            This project is in <span className="font-medium text-foreground">{formatPhase(project.project_phase)}</span>
            {" "}phase with {project.current_team_members.length} active teammate
            {project.current_team_members.length === 1 ? "" : "s"}.
          </p>
        </div>
      </div>
    </div>
  )
}

function SkillFitCard({
  employee,
  project,
}: {
  employee: Employee
  project: Project
}) {
  const requiredSkillEntries = skillKeys
    .map((skill) => [skill, project.required_skills[skill]] as const)
    .filter(([, requirement]) => getRequirementTotal(requirement) > 0)

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Your fit</p>
      {requiredSkillEntries.length ? (
        <div className="space-y-2">
          {requiredSkillEntries.map(([skill, requirement]) => {
            const requiredLevel = getHighestRequiredLevel(requirement)
            const employeeLevel = employee.skills[skill] ?? 0
            return (
              <div
                key={skill}
                className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{skillLabels[skill]}</p>
                  <p className="text-xs text-muted-foreground">
                    Needs L{requiredLevel}; you are L{employeeLevel}
                  </p>
                </div>
                <Badge variant={employeeLevel >= requiredLevel ? "default" : "secondary"}>
                  {employeeLevel >= requiredLevel ? "Strong fit" : "Ramp up"}
                </Badge>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
          No skill requirements stored for this project.
        </p>
      )}
    </div>
  )
}

function TeamCard({ project }: { project: Project }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">Current team</p>
      {project.current_team_members.length ? (
        <div className="space-y-2">
          {project.current_team_members.slice(0, 4).map((member, index) => (
            <div
              key={`${member}-${project.current_team_member_ids[index] ?? index}`}
              className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2"
            >
              <Avatar size="sm">
                <AvatarFallback>{getInitials(member)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 truncate text-sm font-medium">{member}</span>
            </div>
          ))}
          {project.current_team_members.length > 4 ? (
            <p className="text-xs text-muted-foreground">
              +{project.current_team_members.length - 4} more teammates.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
          No teammates are assigned yet.
        </p>
      )}
    </div>
  )
}

function EmptyAssignedProjects({ employee }: { employee: Employee }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
        <HugeiconsIcon icon={Briefcase01Icon} className="mb-3 size-9 text-muted-foreground" />
        <h2 className="text-lg font-semibold">No assigned companies</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {employee.name} is not assigned to a company in the current staffing data.
          Approved move requests will surface onboarding and company context here.
        </p>
        <Button type="button" variant="outline" className="mt-5" asChild>
          <Link href={`/spooner/${employee.id}/requests`}>Review requests</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function EmployeeMyProjectLoadingState() {
  return (
    <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-3xl" />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[520px] rounded-3xl" />
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({
  label,
  value,
  compact = false,
}: {
  label: string
  value: string | number
  compact?: boolean
}) {
  return (
    <div className="rounded-3xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 truncate font-semibold tracking-tight",
          compact ? "text-sm" : "text-2xl"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function PhaseBadge({ phase }: { phase: Project["project_phase"] }) {
  return <Badge variant="secondary">{formatPhase(phase)}</Badge>
}

function getAssignedProjects(employee: Employee, projects: Project[]) {
  const assignedIds = new Set(employee.current_project_ids ?? [])
  const assignedNames = new Set(employee.current_project_names ?? [])

  return projects
    .filter(
      (project) =>
        assignedIds.has(project.id) ||
        assignedNames.has(project.project_name) ||
        project.current_team_member_ids.includes(employee.id)
    )
    .sort((leftProject, rightProject) =>
      leftProject.project_name.localeCompare(rightProject.project_name)
    )
}

function getStaffingGap(project: Project) {
  return Math.max(
    project.required_people_amount - project.current_team_members.length,
    0
  )
}

function getCoveragePercent(project: Project) {
  if (project.required_people_amount <= 0) {
    return 100
  }
  return Math.min(
    100,
    Math.round(
      (project.current_team_members.length / project.required_people_amount) * 100
    )
  )
}

function getRequirementTotal(requirement: ProjectSkillRequirement) {
  return requirement.level_1 + requirement.level_2 + requirement.level_3
}

function getHighestRequiredLevel(requirement: ProjectSkillRequirement) {
  if (requirement.level_3 > 0) {
    return 3
  }
  if (requirement.level_2 > 0) {
    return 2
  }
  return 1
}

function formatPhase(phase: Project["project_phase"]) {
  return phase
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?"
}
