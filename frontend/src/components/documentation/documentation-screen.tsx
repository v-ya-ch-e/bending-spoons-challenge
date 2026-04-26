"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiBrainIcon,
  ArrowRight01Icon,
  DocumentValidationIcon,
  Folder01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import {
  chatWithProjectDocumentation,
  refreshProjectDocumentation,
  type DocumentationChatMessage,
} from "@/lib/backend-api"
import {
  getCachedProjects,
  getProjectDocumentationByProject,
  listProjectDocumentation,
  listProjects,
  updateProjectDocumentationByProject,
  type Project,
  type ProjectDocumentation,
  type ProjectDocumentationStatus,
} from "@/lib/db-api"
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
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type ChatMessage = DocumentationChatMessage

const statusLabels: Record<ProjectDocumentationStatus, string> = {
  pending: "Pending",
  running: "Fetching",
  ready: "Ready",
  failed: "Failed",
}

export function DocumentationScreen() {
  const cachedProjects = getCachedProjects()
  const [projects, setProjects] = useState<Project[]>(() => cachedProjects ?? [])
  const [documentationByProject, setDocumentationByProject] = useState<
    Record<number, ProjectDocumentation | undefined>
  >({})
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [draft, setDraft] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatMode, setChatMode] = useState<"ask" | "edit">("ask")
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(() => !cachedProjects)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isChatting, setIsChatting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId]
  )
  const selectedDocumentation = selectedProject
    ? documentationByProject[selectedProject.id]
    : undefined

  useEffect(() => {
    let isMounted = true

    async function loadWorkspace() {
      try {
        setError(null)
        const [nextProjects, documentation] = await Promise.all([
          listProjects(),
          listProjectDocumentation().catch(() => []),
        ])

        if (!isMounted) {
          return
        }

        setProjects(nextProjects)
        const indexedDocumentation = indexDocumentation(documentation)
        const nextSelectedProjectId = nextProjects[0]?.id ?? null
        setDocumentationByProject(indexedDocumentation)
        setSelectedProjectId(nextSelectedProjectId)
        setDraft(
          nextSelectedProjectId
            ? indexedDocumentation[nextSelectedProjectId]?.content_markdown ?? ""
            : ""
        )
      } catch (loadError) {
        if (!isMounted) {
          return
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load documentation workspace."
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadWorkspace()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedProject || !selectedDocumentation) {
      return
    }
    if (!["pending", "running"].includes(selectedDocumentation.status)) {
      return
    }

    const interval = window.setInterval(async () => {
      try {
        const nextDocumentation = await getProjectDocumentationByProject(selectedProject.id)
        setDocumentationByProject((current) => ({
          ...current,
          [selectedProject.id]: nextDocumentation,
        }))
        if (!isEditing) {
          setDraft(nextDocumentation.content_markdown ?? "")
        }
      } catch {
        // Polling is best effort; manual refresh still surfaces errors.
      }
    }, 3500)

    return () => window.clearInterval(interval)
  }, [isEditing, selectedProject, selectedDocumentation])

  async function handleRefresh() {
    if (!selectedProject) {
      return
    }
    try {
      setIsRefreshing(true)
      setError(null)
      const documentation = await refreshProjectDocumentation(selectedProject.id)
      setDocumentationByProject((current) => ({
        ...current,
        [selectedProject.id]: documentation,
      }))
      if (!isEditing) {
        setDraft(documentation.content_markdown ?? "")
      }
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to fetch documentation from GitHub."
      )
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleSave() {
    if (!selectedProject) {
      return
    }
    try {
      setIsSaving(true)
      setError(null)
      const documentation = await updateProjectDocumentationByProject(selectedProject.id, {
        status: "ready",
        content_markdown: draft,
        last_error: null,
      })
      setDocumentationByProject((current) => ({
        ...current,
        [selectedProject.id]: documentation,
      }))
      setIsEditing(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save documentation.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedProject || !chatInput.trim()) {
      return
    }
    const userMessage: ChatMessage = { role: "user", content: chatInput.trim() }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setChatInput("")

    try {
      setIsChatting(true)
      setError(null)
      const response = await chatWithProjectDocumentation(selectedProject.id, {
        message: userMessage.content,
        history: messages.slice(-6),
        mode: chatMode,
      })
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response.answer,
      }
      setMessages([...nextMessages, assistantMessage])
      if (response.updated_content_markdown) {
        setDraft(response.updated_content_markdown)
        setIsEditing(true)
      }
    } catch (chatError) {
      setMessages(messages)
      setError(chatError instanceof Error ? chatError.message : "Documentation chat failed.")
    } finally {
      setIsChatting(false)
    }
  }

  function selectProject(projectId: number) {
    setSelectedProjectId(projectId)
    setDraft(documentationByProject[projectId]?.content_markdown ?? "")
    setIsEditing(false)
    setMessages([])
    setChatInput("")
  }

  if (isLoading) {
    return <DocumentationLoadingState />
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">CTO workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight">Documentation</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Generate, review, and tune project documentation from GitHub before it is
            reused for onboarding and offboarding.
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={!selectedProject || isRefreshing || !selectedProject.github_repositories.length}
        >
          <HugeiconsIcon icon={DocumentValidationIcon} className="size-4" />
          {isRefreshing ? "Fetching..." : "Fetch new changes from GitHub"}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Documentation workspace error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="min-h-0">
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Select a project to inspect its generated docs.</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0">
            <ScrollArea className="h-[calc(100vh-250px)] pr-3">
              <div className="space-y-2">
                {projects.map((project) => {
                  const documentation = documentationByProject[project.id]
                  const isSelected = selectedProject?.id === project.id
                  return (
                    <button
                      key={project.id}
                      type="button"
                      className={cn(
                        "w-full rounded-3xl border p-3 text-left transition-colors",
                        isSelected
                          ? "border-primary/40 bg-primary/10"
                          : "border-border hover:bg-muted/60"
                      )}
                      onClick={() => selectProject(project.id)}
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
                      <p className="mt-2 text-xs text-muted-foreground">
                        {project.github_repositories.length} GitHub source
                        {project.github_repositories.length === 1 ? "" : "s"}
                      </p>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="min-h-0">
            <CardHeader className="gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>{selectedProject?.project_name ?? "No project selected"}</CardTitle>
                    {selectedDocumentation ? (
                      <DocumentationStatusBadge status={selectedDocumentation.status} />
                    ) : null}
                  </div>
                  <CardDescription>
                    {selectedDocumentation
                      ? formatGeneratedAt(selectedDocumentation)
                      : "No generated documentation has been stored yet."}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSave} disabled={isSaving}>
                        <HugeiconsIcon icon={Tick02Icon} className="size-4" />
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                      disabled={!selectedProject}
                    >
                      Edit docs
                    </Button>
                  )}
                </div>
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
            <CardContent className="min-h-0">
              {!selectedProject ? (
                <EmptyDocumentationState title="No projects" description="Create a project first." />
              ) : !selectedProject.github_repositories.length ? (
                <EmptyDocumentationState
                  title="No GitHub repositories"
                  description="Add at least one GitHub repository to generate documentation."
                />
              ) : selectedDocumentation?.status === "running" ||
                selectedDocumentation?.status === "pending" ? (
                <EmptyDocumentationState
                  title="Documentation is being generated"
                  description="GitHub context is being scanned and summarized. This view will update automatically."
                />
              ) : selectedDocumentation?.status === "failed" ? (
                <EmptyDocumentationState
                  title="Generation failed"
                  description={selectedDocumentation.last_error ?? "Try fetching from GitHub again."}
                />
              ) : isEditing ? (
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="min-h-[calc(100vh-330px)] resize-none font-mono text-sm"
                  placeholder="Write or paste project documentation in Markdown..."
                />
              ) : draft ? (
                <ScrollArea className="h-[calc(100vh-330px)] pr-4">
                  <article className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                    {draft}
                  </article>
                </ScrollArea>
              ) : (
                <EmptyDocumentationState
                  title="No documentation yet"
                  description="Fetch from GitHub to generate the first version."
                />
              )}
            </CardContent>
          </Card>

          <Card className="min-h-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HugeiconsIcon icon={AiBrainIcon} className="size-4" />
                Chat with docs
              </CardTitle>
              <CardDescription>
                Ask questions or request an editable Markdown draft.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-col gap-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={chatMode === "ask" ? "default" : "outline"}
                  onClick={() => setChatMode("ask")}
                >
                  Ask
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={chatMode === "edit" ? "default" : "outline"}
                  onClick={() => setChatMode("edit")}
                >
                  Edit draft
                </Button>
              </div>
              <Separator />
              <ScrollArea className="h-[calc(100vh-430px)] pr-3">
                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <div className="rounded-3xl border border-dashed p-4 text-sm text-muted-foreground">
                      Try “What should a new backend engineer read first?” or “Add
                      offboarding notes for repository ownership.”
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={cn(
                          "rounded-3xl px-4 py-3 text-sm",
                          message.role === "user"
                            ? "ml-8 bg-primary text-primary-foreground"
                            : "mr-8 bg-muted"
                        )}
                      >
                        {message.content}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              <form className="flex gap-2" onSubmit={handleChat}>
                <Input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Ask about this documentation..."
                  disabled={!selectedDocumentation?.content_markdown || isChatting}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!chatInput.trim() || !selectedDocumentation?.content_markdown || isChatting}
                >
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function DocumentationStatusBadge({ status }: { status: ProjectDocumentationStatus }) {
  return (
    <Badge
      variant={status === "failed" ? "destructive" : status === "ready" ? "default" : "secondary"}
    >
      {statusLabels[status]}
    </Badge>
  )
}

function EmptyDocumentationState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed p-8 text-center">
      <HugeiconsIcon icon={Folder01Icon} className="mb-3 size-8 text-muted-foreground" />
      <h2 className="text-base font-medium">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function DocumentationLoadingState() {
  return (
    <div className="grid h-full gap-4 p-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:p-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-44" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-3xl" />
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

function indexDocumentation(documentation: ProjectDocumentation[]) {
  return documentation.reduce<Record<number, ProjectDocumentation>>((indexed, item) => {
    indexed[item.project_id] = item
    return indexed
  }, {})
}

function formatGeneratedAt(documentation: ProjectDocumentation) {
  if (documentation.status === "ready" && documentation.last_generated_at) {
    return `Last generated ${new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(documentation.last_generated_at))}`
  }
  if (documentation.status === "failed") {
    return "The latest GitHub fetch failed."
  }
  return "Waiting for GitHub documentation generation."
}
