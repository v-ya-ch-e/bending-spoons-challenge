"use client"

import {
  useState,
  type ComponentProps,
  type FormEvent,
} from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AiBrainIcon,
  ArrowRight01Icon,
  Folder01Icon,
} from "@hugeicons/core-free-icons"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import {
  streamProjectDocumentationChat,
  type DocumentationChatMessage,
} from "@/lib/backend-api"
import type {
  Project,
  ProjectDocumentation,
  ProjectDocumentationStatus,
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
import { cn } from "@/lib/utils"
import { createTextRevealer } from "@/lib/streaming-text"

type ChatMode = "ask" | "edit"
type ChatMessage = DocumentationChatMessage

const statusLabels: Record<ProjectDocumentationStatus, string> = {
  pending: "Pending",
  running: "Fetching",
  ready: "Ready",
  failed: "Failed",
}

const defaultStarterPrompts = [
  "What should I read first?",
  "Summarize the architecture for my role.",
  "Which repositories should I pay attention to?",
]

export function DocumentationStatusBadge({
  status,
}: {
  status: ProjectDocumentationStatus
}) {
  return (
    <Badge
      variant={status === "failed" ? "destructive" : status === "ready" ? "default" : "secondary"}
    >
      {statusLabels[status]}
    </Badge>
  )
}

export function ProjectDocumentationViewer({
  project,
  documentation,
  markdown,
  generationStatus,
  noProjectDescription = "Create a project first.",
  noRepositoriesDescription = "Add at least one GitHub repository to generate documentation.",
  noDocumentationDescription = "Fetch from GitHub to generate the first version.",
}: {
  project?: Project | null
  documentation?: ProjectDocumentation | null
  markdown: string
  generationStatus?: string | null
  noProjectDescription?: string
  noRepositoriesDescription?: string
  noDocumentationDescription?: string
}) {
  if (!project) {
    return <EmptyDocumentationState title="No projects" description={noProjectDescription} />
  }

  if (markdown) {
    return (
      <ScrollArea className="h-full pr-4">
        <MarkdownDocument markdown={markdown} />
      </ScrollArea>
    )
  }

  if (!project.github_repositories.length) {
    return (
      <EmptyDocumentationState
        title="No GitHub repositories"
        description={noRepositoriesDescription}
      />
    )
  }

  if ((documentation?.status === "running" || documentation?.status === "pending") && !markdown) {
    return (
      <EmptyDocumentationState
        title="Documentation is being generated"
        description={
          generationStatus ??
          "GitHub context is being scanned and summarized. This view will update automatically."
        }
      />
    )
  }

  if (documentation?.status === "failed") {
    return (
      <EmptyDocumentationState
        title="Generation failed"
        description={documentation.last_error ?? "Try fetching from GitHub again."}
      />
    )
  }

  return (
    <EmptyDocumentationState
      title="No documentation yet"
      description={noDocumentationDescription}
    />
  )
}

export function ProjectDocumentationChat({
  project,
  documentation,
  allowEditMode = false,
  onDraftChange,
  onEditingChange,
  onError,
  starterPrompts = defaultStarterPrompts,
  description = "Ask questions about the generated project documentation.",
  className,
}: {
  project?: Project | null
  documentation?: ProjectDocumentation | null
  allowEditMode?: boolean
  onDraftChange?: (markdown: string) => void
  onEditingChange?: (isEditing: boolean) => void
  onError?: (message: string) => void
  starterPrompts?: string[]
  description?: string
  className?: string
}) {
  return (
    <ProjectDocumentationChatContent
      key={project?.id ?? "empty-documentation-chat"}
      project={project}
      documentation={documentation}
      allowEditMode={allowEditMode}
      onDraftChange={onDraftChange}
      onEditingChange={onEditingChange}
      onError={onError}
      starterPrompts={starterPrompts}
      description={description}
      className={className}
    />
  )
}

function ProjectDocumentationChatContent({
  project,
  documentation,
  allowEditMode,
  onDraftChange,
  onEditingChange,
  onError,
  starterPrompts,
  description,
  className,
}: {
  project?: Project | null
  documentation?: ProjectDocumentation | null
  allowEditMode: boolean
  onDraftChange?: (markdown: string) => void
  onEditingChange?: (isEditing: boolean) => void
  onError?: (message: string) => void
  starterPrompts: string[]
  description: string
  className?: string
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatMode, setChatMode] = useState<ChatMode>("ask")
  const [isChatting, setIsChatting] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const canChat = Boolean(project && documentation?.content_markdown?.trim())

  async function sendMessage(message: string) {
    const trimmedMessage = message.trim()
    if (!project || !trimmedMessage || !canChat) {
      return
    }

    const previousMessages = messages
    const userMessage: ChatMessage = { role: "user", content: trimmedMessage }
    const nextMessages = [...messages, userMessage]
    const assistantIndex = nextMessages.length
    setMessages([...nextMessages, { role: "assistant", content: "" }])
    setChatInput("")

    try {
      setIsChatting(true)
      setChatError(null)
      onError?.("")
      let streamedAnswer = ""
      const answerRevealer = createTextRevealer({
        onText: (text) => {
          streamedAnswer = text
          setMessages((current) =>
            current.map((currentMessage, index) =>
              index === assistantIndex
                ? { ...currentMessage, content: text }
                : currentMessage
            )
          )
        },
      })
      const draftRevealer = createTextRevealer({
        onText: (text) => {
          onDraftChange?.(text)
          onEditingChange?.(true)
        },
      })
      let finalAnswer: string | undefined
      let finalDraft: string | undefined

      await streamProjectDocumentationChat(
        project.id,
        {
          message: userMessage.content,
          history: messages.slice(-6),
          mode: allowEditMode ? chatMode : "ask",
        },
        (streamEvent, data) => {
          if (streamEvent === "answer_delta" && typeof data.delta === "string") {
            answerRevealer.enqueue(data.delta)
            return
          }

          if (
            allowEditMode &&
            streamEvent === "draft_delta" &&
            typeof data.delta === "string"
          ) {
            draftRevealer.enqueue(data.delta)
            return
          }

          if (streamEvent === "done") {
            if (typeof data.answer === "string" && data.answer.trim()) {
              finalAnswer = data.answer
            }
            if (allowEditMode && typeof data.updated_content_markdown === "string") {
              finalDraft = data.updated_content_markdown
            }
            return
          }

          if (streamEvent === "error") {
            throw new Error(
              typeof data.message === "string" ? data.message : "Documentation chat failed."
            )
          }
        }
      )

      await Promise.all([
        answerRevealer.finish(finalAnswer),
        draftRevealer.finish(finalDraft),
      ])

      if (!streamedAnswer) {
        setMessages((current) =>
          current.map((currentMessage, index) =>
            index === assistantIndex
              ? { ...currentMessage, content: "Done." }
              : currentMessage
          )
        )
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Documentation chat failed."
      setMessages(previousMessages)
      setChatError(message)
      onError?.(message)
    } finally {
      setIsChatting(false)
    }
  }

  function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendMessage(chatInput)
  }

  return (
    <Card
      className={cn(
        "flex min-h-0 flex-col overflow-hidden border border-border shadow-none ring-0",
        className
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={AiBrainIcon} className="size-4" />
          Chat with docs
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        {chatError ? (
          <Alert variant="destructive">
            <AlertTitle>Documentation chat failed</AlertTitle>
            <AlertDescription>{chatError}</AlertDescription>
          </Alert>
        ) : null}

        {allowEditMode ? (
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
        ) : null}

        <Separator />
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 pr-4">
            {messages.length === 0 ? (
              <div className="space-y-3 rounded-3xl border border-dashed p-4 text-sm text-muted-foreground">
                <p>
                  {canChat
                    ? "Start with one of these prompts or ask your own question."
                    : "Generated documentation is required before chat is available."}
                </p>
                {canChat ? (
                  <div className="flex min-w-0 flex-col gap-2">
                    {starterPrompts.map((prompt) => (
                      <Button
                        key={prompt}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto w-full min-w-0 shrink justify-start whitespace-normal rounded-2xl px-3 py-1.5 text-left leading-snug"
                        disabled={isChatting}
                        onClick={() => void sendMessage(prompt)}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn(
                    "w-fit max-w-[calc(100%-2rem)] whitespace-pre-wrap break-words rounded-3xl px-4 py-3 text-sm leading-6",
                    message.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto bg-muted"
                  )}
                >
                  {message.content || (
                    <span className="text-muted-foreground">Thinking...</span>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <form className="flex gap-2" onSubmit={handleChatSubmit}>
          <Input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Ask about this documentation..."
            disabled={!canChat || isChatting}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!chatInput.trim() || !canChat || isChatting}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function EmptyDocumentationState({
  title,
  description,
  className,
}: {
  title: string
  description: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed p-8 text-center",
        className
      )}
    >
      <HugeiconsIcon icon={Folder01Icon} className="mb-3 size-8 text-muted-foreground" />
      <h2 className="text-base font-medium">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function MarkdownDocument({ markdown }: { markdown: string }) {
  return (
    <article className="pb-4 text-sm leading-7 text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </article>
  )
}

const markdownComponents = {
  h1: (props: ComponentProps<"h1">) => (
    <h1 className="mb-4 text-2xl font-semibold tracking-tight" {...props} />
  ),
  h2: (props: ComponentProps<"h2">) => (
    <h2 className="mt-7 mb-3 text-xl font-semibold tracking-tight" {...props} />
  ),
  h3: (props: ComponentProps<"h3">) => (
    <h3 className="mt-6 mb-2 text-base font-semibold" {...props} />
  ),
  p: (props: ComponentProps<"p">) => (
    <p className="my-3 text-muted-foreground" {...props} />
  ),
  ul: (props: ComponentProps<"ul">) => (
    <ul className="my-3 list-disc space-y-1 pl-5" {...props} />
  ),
  ol: (props: ComponentProps<"ol">) => (
    <ol className="my-3 list-decimal space-y-1 pl-5" {...props} />
  ),
  li: (props: ComponentProps<"li">) => (
    <li className="pl-1 text-foreground" {...props} />
  ),
  a: (props: ComponentProps<"a">) => (
    <a
      className="font-medium text-primary underline-offset-4 hover:underline"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  code: (props: ComponentProps<"code">) => (
    <code
      className={cn(
        "rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs",
        props.className
      )}
      {...props}
    />
  ),
  pre: (props: ComponentProps<"pre">) => (
    <pre
      className="my-4 overflow-x-auto rounded-3xl bg-muted p-4 text-sm"
      {...props}
    />
  ),
  blockquote: (props: ComponentProps<"blockquote">) => (
    <blockquote
      className="my-4 border-l-2 border-border pl-4 text-muted-foreground"
      {...props}
    />
  ),
  table: (props: ComponentProps<"table">) => (
    <div className="my-4 overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-left text-sm" {...props} />
    </div>
  ),
  th: (props: ComponentProps<"th">) => (
    <th className="border-b bg-muted px-3 py-2 font-medium" {...props} />
  ),
  td: (props: ComponentProps<"td">) => (
    <td className="border-b px-3 py-2 align-top last:border-b-0" {...props} />
  ),
}

export function indexDocumentation(documentation: ProjectDocumentation[]) {
  return documentation.reduce<Record<number, ProjectDocumentation>>((indexed, item) => {
    indexed[item.project_id] = item
    return indexed
  }, {})
}

export function isProjectDocumentation(value: unknown): value is ProjectDocumentation {
  return Boolean(
    value &&
      typeof value === "object" &&
      "project_id" in value &&
      "content_markdown" in value &&
      "status" in value
  )
}

export function formatGeneratedAt(documentation: ProjectDocumentation) {
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
