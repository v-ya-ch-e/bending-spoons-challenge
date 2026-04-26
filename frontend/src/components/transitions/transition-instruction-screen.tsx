"use client"

import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckListIcon,
  Task01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import {
  listEmployeeTransitionInstructions,
  markTransitionInstructionSolved,
  type TransitionInstruction,
  type TransitionInstructionStatus,
  type TransitionInstructionType,
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
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type TransitionInstructionScreenProps = {
  employeeId: number
  instructionType: TransitionInstructionType
}

const statusLabels: Record<TransitionInstructionStatus, string> = {
  pending: "Pending",
  running: "Generating",
  ready: "Ready",
  failed: "Failed",
  solved: "Solved",
}

const screenCopy = {
  onboarding: {
    title: "Onboarding",
    eyebrow: "New company ramp-up",
    description: "Follow the generated instructions to join the target company cleanly.",
    emptyTitle: "No onboarding instructions yet",
    emptyDescription:
      "Once the transition is approved and instructions are generated, they will appear here.",
  },
  offboarding: {
    title: "Offboarding",
    eyebrow: "Company handoff",
    description: "Wrap up the source company with a clear handoff trail.",
    emptyTitle: "No offboarding instructions yet",
    emptyDescription:
      "Once the transition is approved and handoff instructions are generated, they will appear here.",
  },
} satisfies Record<
  TransitionInstructionType,
  {
    title: string
    eyebrow: string
    description: string
    emptyTitle: string
    emptyDescription: string
  }
>

export function TransitionInstructionScreen({
  employeeId,
  instructionType,
}: TransitionInstructionScreenProps) {
  const [instructions, setInstructions] = useState<TransitionInstruction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const instruction = instructions[0]
  const copy = screenCopy[instructionType]
  const progressValue = instruction?.status === "solved" ? 100 : instruction ? 50 : 0
  const isSolved = instruction?.status === "solved"

  const projectLabel = useMemo(() => {
    if (!instruction) {
      return null
    }
    return instructionType === "onboarding"
      ? instruction.to_project_name
      : instruction.from_project_name ?? instruction.to_project_name
  }, [instruction, instructionType])

  useEffect(() => {
    let isMounted = true

    async function loadInstructions() {
      try {
        setIsLoading(true)
        setError(null)
        const nextInstructions = await listEmployeeTransitionInstructions(
          employeeId,
          instructionType
        )
        if (isMounted) {
          setInstructions(nextInstructions)
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load transition instructions."
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadInstructions()

    return () => {
      isMounted = false
    }
  }, [employeeId, instructionType])

  async function handleMarkSolved() {
    if (!instruction || isSolved) {
      return
    }

    try {
      setIsSaving(true)
      setError(null)
      const solvedInstruction = await markTransitionInstructionSolved(
        instruction.move_request_id,
        instruction.instruction_type,
        employeeId
      )
      setInstructions((current) =>
        current.map((currentInstruction) =>
          currentInstruction.id === solvedInstruction.id
            ? solvedInstruction
            : currentInstruction
        )
      )
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to mark the instruction as solved."
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <TransitionInstructionLoadingState />
  }

  return (
    <div className="min-h-full bg-muted/20">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3">
              {copy.eyebrow}
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {copy.description}
            </p>
          </div>

          {instruction ? (
            <Button
              type="button"
              onClick={handleMarkSolved}
              disabled={isSaving || isSolved}
              className="w-fit"
            >
              <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4" />
              {isSolved ? "Solved" : isSaving ? "Saving..." : "Mark as solved"}
            </Button>
          ) : null}
        </header>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Transition instructions error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!instruction ? (
          <EmptyTransitionState
            title={copy.emptyTitle}
            description={copy.emptyDescription}
            instructionType={instructionType}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
            <TransitionSummaryCard
              instruction={instruction}
              instructionType={instructionType}
              projectLabel={projectLabel}
              progressValue={progressValue}
            />

            <Card className="min-h-[calc(100vh-16rem)]">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Generated instructions</CardTitle>
                    <CardDescription>
                      Markdown content generated from company documentation and transition context.
                    </CardDescription>
                  </div>
                  <TransitionStatusBadge status={instruction.status} />
                </div>
              </CardHeader>
              <CardContent>
                {instruction.status === "failed" ? (
                  <EmptyTransitionState
                    title="Instruction generation failed"
                    description={instruction.last_error ?? "Try generating the instructions again."}
                    instructionType={instructionType}
                  />
                ) : instruction.content_markdown.trim() ? (
                  <ScrollArea className="h-[calc(100vh-23rem)] pr-4">
                    <MarkdownContent content={instruction.content_markdown} />
                  </ScrollArea>
                ) : (
                  <EmptyTransitionState
                    title="Instructions are empty"
                    description="The instruction row exists, but no Markdown content has been stored yet."
                    instructionType={instructionType}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function TransitionSummaryCard({
  instruction,
  instructionType,
  projectLabel,
  progressValue,
}: {
  instruction: TransitionInstruction
  instructionType: TransitionInstructionType
  projectLabel: string | null
  progressValue: number
}) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon
            icon={instructionType === "onboarding" ? CheckListIcon : Task01Icon}
            strokeWidth={2}
            className="size-4"
          />
          Transition context
        </CardTitle>
        <CardDescription>
          {instruction.employee_name} toward {instruction.to_project_name}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progressValue}%</span>
          </div>
          <Progress value={progressValue} />
        </div>

        <Separator />

        <dl className="space-y-3 text-sm">
          <SummaryItem label="Employee" value={instruction.employee_name} />
          <SummaryItem
            label={instructionType === "onboarding" ? "Target company" : "Source company"}
            value={projectLabel ?? "Not set"}
          />
          <SummaryItem
            label="Move request"
            value={`#${instruction.move_request_id}`}
          />
          <SummaryItem
            label="Updated"
            value={formatDateTime(instruction.updated_at)}
          />
          <SummaryItem
            label="Solved"
            value={instruction.solved_at ? formatDateTime(instruction.solved_at) : "Not yet"}
          />
        </dl>
      </CardContent>
    </Card>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-40 text-right font-medium">{value}</dd>
    </div>
  )
}

function TransitionStatusBadge({ status }: { status: TransitionInstructionStatus }) {
  return (
    <Badge
      variant={
        status === "failed"
          ? "destructive"
          : status === "solved"
            ? "default"
            : status === "ready"
              ? "secondary"
              : "outline"
      }
    >
      {statusLabels[status]}
    </Badge>
  )
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <article className="text-sm leading-7 text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
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

function EmptyTransitionState({
  title,
  description,
  instructionType,
}: {
  title: string
  description: string
  instructionType: TransitionInstructionType
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
        <HugeiconsIcon
          icon={instructionType === "onboarding" ? CheckListIcon : Task01Icon}
          strokeWidth={2}
          className="mb-3 size-8 text-muted-foreground"
        />
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function TransitionInstructionLoadingState() {
  return (
    <div className="min-h-full bg-muted/20">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-[calc(100vh-16rem)] rounded-3xl" />
        </div>
      </div>
    </div>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
