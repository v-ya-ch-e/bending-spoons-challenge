"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowRight01Icon,
  BookOpen01Icon,
  Briefcase01Icon,
} from "@hugeicons/core-free-icons"

import {
  getProjectDocumentationByProject,
  listEmployees,
  listMoveRequests,
  listProjects,
  type Employee,
  type MoveRequest,
  type Project,
  type ProjectDocumentation,
} from "@/lib/db-api"
import {
  DocumentationStatusBadge,
  ProjectDocumentationChat,
  ProjectDocumentationViewer,
  formatGeneratedAt,
} from "@/components/documentation/project-documentation-panel"
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
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

type EmployeeProjectResourcesScreenProps = {
  employeeId: number
  projectId: number
}

type ResolutionState =
  | { status: "loading" }
  | {
      status: "ready"
      employee: Employee
      project: Project
      documentation: ProjectDocumentation | null
    }
  | { status: "missing" }
  | { status: "error"; message: string }

type AddedProjectResource = {
  id: string
  title: string
  url: string
  note: string
}

const chatPrompts = [
  "What should I read first?",
  "Summarize the architecture for my role.",
  "Which repositories should I pay attention to?",
  "What are the likely onboarding risks?",
]

export function EmployeeProjectResourcesScreen({
  employeeId,
  projectId,
}: EmployeeProjectResourcesScreenProps) {
  const [resolution, setResolution] = useState<ResolutionState>({ status: "loading" })

  useEffect(() => {
    let isMounted = true

    async function loadResources() {
      try {
        setResolution((current) =>
          current.status === "ready" ? current : { status: "loading" }
        )

        const [employees, projects, documentation, moveRequests] = await Promise.all([
          listEmployees(),
          listProjects(),
          getProjectDocumentationByProject(projectId).catch(() => null),
          listMoveRequests().catch(() => []),
        ])

        if (!isMounted) {
          return
        }

        const employee = employees.find((entry) => entry.id === employeeId)
        const project = projects.find((entry) => entry.id === projectId)

        if (!employee || !project) {
          setResolution({ status: "missing" })
          return
        }

        const assignedProjects = getAssignedProjects(employee, projects, moveRequests)
        if (!assignedProjects.some((entry) => entry.id === projectId)) {
          setResolution({ status: "missing" })
          return
        }

        setResolution({
          status: "ready",
          employee,
          project,
          documentation,
        })
      } catch (error) {
        if (!isMounted) {
          return
        }
        setResolution({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load project resources.",
        })
      }
    }

    loadResources()

    return () => {
      isMounted = false
    }
  }, [employeeId, projectId])

  if (resolution.status === "loading") {
    return <ProjectResourcesLoadingState />
  }

  if (resolution.status === "error") {
    return (
      <div className="p-4 sm:p-6">
        <Alert variant="destructive">
          <AlertTitle>Could not load resources</AlertTitle>
          <AlertDescription>{resolution.message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (resolution.status === "missing") {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <Card className="max-w-md border-dashed text-center">
          <CardContent className="p-8">
            <HugeiconsIcon
              icon={Briefcase01Icon}
              className="mx-auto mb-3 size-9 text-muted-foreground"
            />
            <h1 className="text-lg font-semibold">Resources not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This project is not linked to the selected Spooner.
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link href={`/spooner/${employeeId}/my-project`}>Back to My Projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <ProjectResourcesContent
      employee={resolution.employee}
      project={resolution.project}
      documentation={resolution.documentation}
    />
  )
}

function ProjectResourcesContent({
  employee,
  project,
  documentation,
}: {
  employee: Employee
  project: Project
  documentation: ProjectDocumentation | null
}) {
  const documentationMarkdown = documentation?.content_markdown ?? ""

  return (
    <div className="min-h-full bg-background">
      <div className="flex flex-col gap-5 p-4 sm:p-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm text-muted-foreground">Project resources</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.project_name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Read the docs and keep the assistant open while reviewing project
              repositories and belongings.
            </p>
          </div>
          <Button asChild variant="outline" className="w-fit rounded-full">
            <Link href={`/spooner/${employee.id}/my-project`}>Back to My Projects</Link>
          </Button>
        </header>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <ProjectResourceList
            employee={employee}
            project={project}
            documentation={documentation}
          />

          <div className="grid min-h-0 gap-4 2xl:grid-cols-2">
            <Card className="flex min-h-[42rem] min-w-0 flex-col overflow-hidden">
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle>Documentation</CardTitle>
                      {documentation ? (
                        <DocumentationStatusBadge status={documentation.status} />
                      ) : (
                        <Badge variant="outline">No docs</Badge>
                      )}
                    </div>
                    <CardDescription>
                      {documentation
                        ? formatGeneratedAt(documentation)
                        : "No generated documentation has been stored yet."}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1">
                <ProjectDocumentationViewer
                  project={project}
                  documentation={documentation}
                  markdown={documentationMarkdown}
                  noDocumentationDescription="Generated docs are not ready yet. Ask your CTO to fetch documentation from GitHub."
                />
              </CardContent>
            </Card>

            <ProjectDocumentationChat
              project={project}
              documentation={documentation}
              starterPrompts={chatPrompts}
              description="Ask about this project's docs while reading them."
              className="min-h-[42rem]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ProjectResourceList({
  employee,
  project,
  documentation,
}: {
  employee: Employee
  project: Project
  documentation: ProjectDocumentation | null
}) {
  const [isAddingResource, setIsAddingResource] = useState(false)
  const [addedResources, setAddedResources] = useState<AddedProjectResource[]>([])
  const [draftTitle, setDraftTitle] = useState("")
  const [draftUrl, setDraftUrl] = useState("")
  const [draftNote, setDraftNote] = useState("")
  const repositories = useMemo(
    () =>
      Array.from(
        new Set([
          ...project.github_repositories,
          ...(documentation?.source_repositories ?? []),
        ])
      ),
    [documentation?.source_repositories, project.github_repositories]
  )

  function handleAddResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = draftTitle.trim()

    if (!title) {
      return
    }

    setAddedResources((currentResources) => [
      {
        id: `${Date.now()}-${title}`,
        title,
        url: draftUrl.trim(),
        note: draftNote.trim(),
      },
      ...currentResources,
    ])
    setDraftTitle("")
    setDraftUrl("")
    setDraftNote("")
    setIsAddingResource(false)
  }

  return (
    <Card className="h-fit xl:sticky xl:top-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={BookOpen01Icon} className="size-4" />
          Resources
        </CardTitle>
        <CardDescription>
          Project belongings and links available to {employee.name}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[calc(100vh-14rem)] pr-3">
          <div className="space-y-5">
            <section className="rounded-3xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Documentation</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {documentation
                      ? formatGeneratedAt(documentation)
                      : "No generated documentation yet."}
                  </p>
                </div>
                {documentation ? (
                  <DocumentationStatusBadge status={documentation.status} />
                ) : (
                  <Badge variant="outline">No docs</Badge>
                )}
              </div>
            </section>

            <section>
              <p className="mb-2 text-sm font-medium">GitHub repositories</p>
              {repositories.length ? (
                <div className="space-y-2">
                  {repositories.map((repository) => (
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
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
                  No repositories connected.
                </p>
              )}
            </section>

            <section className="grid gap-2">
              <p className="text-sm font-medium">Project belongings</p>
              <ResourceFact label="Phase" value={formatPhase(project.project_phase)} />
              <ResourceFact
                label="Team"
                value={`${project.current_team_members.length} teammate${
                  project.current_team_members.length === 1 ? "" : "s"
                }`}
              />
              <ResourceFact
                label="Staffing target"
                value={`${project.required_people_amount} people`}
              />
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Added resources</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingResource((current) => !current)}
                >
                  <HugeiconsIcon icon={Add01Icon} className="size-4" />
                  Add
                </Button>
              </div>

              {isAddingResource ? (
                <form
                  className="mb-3 space-y-3 rounded-3xl border border-border p-3"
                  onSubmit={handleAddResource}
                >
                  <Input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder="Resource name"
                  />
                  <Input
                    value={draftUrl}
                    onChange={(event) => setDraftUrl(event.target.value)}
                    placeholder="Optional URL"
                    type="url"
                  />
                  <Textarea
                    value={draftNote}
                    onChange={(event) => setDraftNote(event.target.value)}
                    placeholder="Optional note"
                  />
                  <Button type="submit" size="sm" disabled={!draftTitle.trim()}>
                    Save mock resource
                  </Button>
                </form>
              ) : null}

              {addedResources.length ? (
                <div className="space-y-2">
                  {addedResources.map((resource) => (
                    <div
                      key={resource.id}
                      className="rounded-2xl border border-border bg-card p-3"
                    >
                      <p className="text-sm font-medium">{resource.title}</p>
                      {resource.url ? (
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block truncate text-xs text-muted-foreground hover:text-foreground"
                        >
                          {resource.url}
                        </a>
                      ) : null}
                      {resource.note ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {resource.note}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
                  Add a resource to mock how extra project links will appear here.
                </p>
              )}
            </section>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function ResourceFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function ProjectResourcesLoadingState() {
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-40 rounded-full" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-2xl" />
            ))}
          </CardContent>
        </Card>
        <div className="grid gap-4 2xl:grid-cols-2">
          <Skeleton className="h-[42rem] rounded-3xl" />
          <Skeleton className="h-[42rem] rounded-3xl" />
        </div>
      </div>
    </div>
  )
}

function getAssignedProjects(
  employee: Employee,
  projects: Project[],
  transitionRequests: MoveRequest[] = []
) {
  const assignedIds = new Set(employee.current_project_ids ?? [])
  const assignedNames = new Set(employee.current_project_names ?? [])
  for (const request of transitionRequests) {
    if (request.from_project_id !== null) {
      assignedIds.add(request.from_project_id)
    }
    assignedIds.add(request.to_project_id)
  }

  return projects.filter(
    (project) =>
      assignedIds.has(project.id) ||
      assignedNames.has(project.project_name) ||
      project.current_team_member_ids.includes(employee.id)
  )
}

function formatPhase(phase: Project["project_phase"]) {
  return phase
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
