"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
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
import { Skeleton } from "@/components/ui/skeleton"

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
              <Link href={`/spooner/${employeeId}/my-project`}>Back to My Companies</Link>
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
              Read the docs and keep the assistant open while reviewing project context.
            </p>
          </div>
          <Button asChild variant="outline" className="w-fit rounded-full">
            <Link href={`/spooner/${employee.id}/my-project`}>Back to My Companies</Link>
          </Button>
        </header>

        <div className="grid min-h-0 items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.8fr)]">
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
            className="h-[calc(100svh-7rem)] lg:sticky lg:top-6"
          />
        </div>
      </div>
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
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[42rem] rounded-3xl" />
        <Skeleton className="h-[42rem] rounded-3xl" />
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
    if (request.to_project_id !== null) {
      assignedIds.add(request.to_project_id)
    }
  }

  return projects.filter(
    (project) =>
      assignedIds.has(project.id) ||
      assignedNames.has(project.project_name) ||
      project.current_team_member_ids.includes(employee.id)
  )
}

