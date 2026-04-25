"use client"

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiBrainIcon,
  ArrowRight01Icon,
  DocumentValidationIcon,
  Folder01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import {
  streamProjectDocumentationChat,
  streamProjectDocumentationRefresh,
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
  const [generationStatus, setGenerationStatus] = useState<string | null>(null)
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
      setGenerationStatus("Queued GitHub documentation scan.")
      setError(null)
      setDraft("")
      await streamProjectDocumentationRefresh(selectedProject.id, (event, data) => {
        if (event === "status") {
          if (typeof data.message === "string") {
            setGenerationStatus(data.message)
          }
          const documentation = data.documentation
          if (isProjectDocumentation(documentation)) {
            setDocumentationByProject((current) => ({
              ...current,
              [selectedProject.id]: documentation,
            }))
          }
          return
        }

        if (event === "content_delta" && typeof data.delta === "string") {
          setDraft((current) => current + data.delta)
          return
        }

        if (event === "done") {
          setGenerationStatus(null)
          const documentation = data.documentation
          if (isProjectDocumentation(documentation)) {
            setDocumentationByProject((current) => ({
              ...current,
              [selectedProject.id]: documentation,
            }))
            setDraft(documentation.content_markdown ?? "")
          }
          return
        }

        if (event === "error") {
          setGenerationStatus(null)
          const documentation = data.documentation
          if (isProjectDocumentation(documentation)) {
            setDocumentationByProject((current) => ({
              ...current,
              [selectedProject.id]: documentation,
            }))
          }
          throw new Error(
            typeof data.message === "string"
              ? data.message
              : "Unable to fetch documentation from GitHub."
          )
        }
      })
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to fetch documentation from GitHub."
      )
    } finally {
      setGenerationStatus(null)
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
    const assistantIndex = nextMessages.length
    setMessages([...nextMessages, { role: "assistant", content: "" }])
    setChatInput("")

    try {
      setIsChatting(true)
      setError(null)
      let streamedAnswer = ""
      let streamedDraft = ""
      await streamProjectDocumentationChat(selectedProject.id, {
        message: userMessage.content,
        history: messages.slice(-6),
        mode: chatMode,
      }, (streamEvent, data) => {
        if (streamEvent === "answer_delta" && typeof data.delta === "string") {
          streamedAnswer += data.delta
          setMessages((current) =>
            current.map((message, index) =>
              index === assistantIndex
                ? { ...message, content: streamedAnswer }
                : message
            )
          )
          return
        }

        if (streamEvent === "draft_delta" && typeof data.delta === "string") {
          streamedDraft += data.delta
          setDraft(streamedDraft)
          setIsEditing(true)
          return
        }

        if (streamEvent === "done") {
          if (typeof data.answer === "string" && data.answer.trim()) {
            streamedAnswer = data.answer
            setMessages((current) =>
              current.map((message, index) =>
                index === assistantIndex
                  ? { ...message, content: streamedAnswer }
                  : message
              )
            )
          }
          if (typeof data.updated_content_markdown === "string") {
            setDraft(data.updated_content_markdown)
            setIsEditing(true)
          }
          return
        }

        if (streamEvent === "error") {
          throw new Error(
            typeof data.message === "string" ? data.message : "Documentation chat failed."
          )
        }
      })

      if (!streamedAnswer) {
        setMessages((current) =>
          current.map((message, index) =>
            index === assistantIndex
              ? { ...message, content: "Done." }
              : message
          )
        )
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
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4 lg:p-6">
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

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Select a project to inspect its generated docs.</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <ScrollArea className="h-full pr-3">
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

        <div className="grid min-h-0 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="flex min-h-0 flex-col overflow-hidden">
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
            <CardContent className="min-h-0 flex-1">
              {!selectedProject ? (
                <EmptyDocumentationState title="No projects" description="Create a project first." />
              ) : !selectedProject.github_repositories.length ? (
                <EmptyDocumentationState
                  title="No GitHub repositories"
                  description="Add at least one GitHub repository to generate documentation."
                />
              ) : (selectedDocumentation?.status === "running" ||
                selectedDocumentation?.status === "pending") && !draft ? (
                <EmptyDocumentationState
                  title="Documentation is being generated"
                  description={
                    generationStatus ??
                    "GitHub context is being scanned and summarized. This view will update automatically."
                  }
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
                  className="h-full min-h-[360px] resize-none font-mono text-sm"
                  placeholder="Write or paste project documentation in Markdown..."
                />
              ) : draft ? (
                <ScrollArea className="h-full pr-4">
                  <MarkdownDocument markdown={draft} />
                </ScrollArea>
              ) : (
                <EmptyDocumentationState
                  title="No documentation yet"
                  description="Fetch from GitHub to generate the first version."
                />
              )}
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HugeiconsIcon icon={AiBrainIcon} className="size-4" />
                Chat with docs
              </CardTitle>
              <CardDescription>
                Ask questions or request an editable Markdown draft.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
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
              <ScrollArea className="min-h-0 flex-1 pr-3">
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

function MarkdownDocument({ markdown }: { markdown: string }) {
  const blocks = parseMarkdownBlocks(markdown)

  return (
    <article className="space-y-4 pb-4 text-sm leading-7 text-foreground">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = `h${block.level}` as "h1" | "h2" | "h3"
          return (
            <HeadingTag
              key={index}
              className={cn(
                "font-semibold tracking-tight",
                block.level === 1 && "text-xl",
                block.level === 2 && "pt-2 text-lg",
                block.level === 3 && "pt-1 text-base"
              )}
            >
              {renderInlineMarkdown(block.content)}
            </HeadingTag>
          )
        }

        if (block.type === "list") {
          return (
            <ul key={index} className="ml-5 list-disc space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          )
        }

        if (block.type === "ordered-list") {
          return (
            <ol key={index} className="ml-5 list-decimal space-y-1">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ol>
          )
        }

        if (block.type === "code") {
          return (
            <pre
              key={index}
              className="overflow-x-auto rounded-2xl border bg-muted/50 p-3 text-xs leading-6"
            >
              <code>{block.content}</code>
            </pre>
          )
        }

        if (block.type === "rule") {
          return <Separator key={index} />
        }

        return <p key={index}>{renderInlineMarkdown(block.content)}</p>
      })}
    </article>
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

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; content: string }
  | { type: "paragraph"; content: string }
  | { type: "list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "code"; content: string }
  | { type: "rule" }

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const lines = markdown.replace(/\r\n/g, "\n").split("\n")
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index])
        index += 1
      }
      blocks.push({ type: "code", content: codeLines.join("\n") })
      index += 1
      continue
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push({ type: "rule" })
      index += 1
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed)
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        content: heading[2],
      })
      index += 1
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""))
        index += 1
      }
      blocks.push({ type: "list", items })
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""))
        index += 1
      }
      blocks.push({ type: "ordered-list", items })
      continue
    }

    const paragraphLines: string[] = [trimmed]
    index += 1
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,3})\s+/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim()) &&
      !lines[index].trim().startsWith("```")
    ) {
      paragraphLines.push(lines[index].trim())
      index += 1
    }
    blocks.push({ type: "paragraph", content: paragraphLines.join(" ") })
  }

  return blocks
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean)
  return segments.map((segment, index) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return <strong key={index}>{segment.slice(2, -2)}</strong>
    }
    if (segment.startsWith("`") && segment.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-muted px-1 py-0.5 text-xs">
          {segment.slice(1, -1)}
        </code>
      )
    }
    return <span key={index}>{segment}</span>
  })
}

function isProjectDocumentation(value: unknown): value is ProjectDocumentation {
  return Boolean(
    value &&
      typeof value === "object" &&
      "project_id" in value &&
      "content_markdown" in value &&
      "status" in value
  )
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
