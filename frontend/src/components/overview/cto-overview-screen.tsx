import Link from "next/link"
import type { ReactNode } from "react"
import {
  Add01Icon,
  ChartRelationshipIcon,
  DocumentValidationIcon,
  Folder01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { buildMovePlans } from "@/components/matching/matching-model"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { OverviewInitialData } from "@/lib/server/db-api"
import type { Project } from "@/lib/db-api"
import { cn } from "@/lib/utils"

type CtoOverviewScreenProps = {
  initialData?: OverviewInitialData | null
}

const overviewCardClass = "border border-border shadow-none ring-0"
const visualPanelClass =
  "h-28 overflow-hidden rounded-[calc(var(--radius-4xl)-1rem)] border border-border bg-muted/30"

export function CtoOverviewScreen({ initialData }: CtoOverviewScreenProps) {
  if (!initialData) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className={cn("max-w-md text-center", overviewCardClass)}>
          <CardHeader>
            <CardTitle>Overview is taking a minute</CardTitle>
            <CardDescription>
              The database did not return enough data for the CTO snapshot. Try again
              once the API is reachable.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const { employees, projects, documentation, moveRequests, runBundles } = initialData
  const plans = buildMovePlans({ employees, projects, moveRequests, runBundles })
  const activePlans = plans.filter((plan) => plan.lifecycle === "active")
  const draftPlans = plans.filter((plan) => plan.lifecycle === "draft")
  const readyPlans = plans.filter((plan) => plan.lifecycle === "ready")
  const readyDocumentation = documentation.filter((item) => item.status === "ready")

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 md:p-8">
        <header className="mx-auto flex max-w-3xl flex-col items-center gap-4 py-8 text-center md:py-12">
          <Badge variant="outline">CTO workspace</Badge>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Welcome to Mixing Spooners.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
            Keep companies staffed, move people with context, and generate the docs
            that make handoffs feel less chaotic.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ActionCard
            eyebrow={`${projects.length} companies`}
            title="Map the portfolio"
            description="Review companies, staffing gaps, requirements, repos, and ownership in one place."
            href="/cto/projects"
            action="Open companies"
            secondaryHref="/cto/projects?create=1"
            secondaryAction="Add company"
            icon={Folder01Icon}
            visual={<ProjectVisual projects={projects} />}
          />
          <ActionCard
            eyebrow={`${employees.length} Spooners`}
            title="Find the right people"
            description="Browse skills, current assignments, interests, and where each person could help next."
            href="/cto/employees"
            action="Open employees"
            secondaryHref="/cto/employees?create=1"
            secondaryAction="Add employee"
            icon={UserGroupIcon}
            visual={<PeopleVisual names={employees.map((employee) => employee.name)} />}
          />
          <ActionCard
            eyebrow={`${plans.length} move plans`}
            title="Plan a move"
            description={`${draftPlans.length} drafts, ${activePlans.length} active, and ${readyPlans.length} ready to execute.`}
            href="/cto/matching"
            action="Open matching"
            secondaryHref="/cto/matching?create=1"
            secondaryAction="Create plan"
            icon={ChartRelationshipIcon}
            visual={
              <MatchingVisual
                draftCount={draftPlans.length}
                activeCount={activePlans.length}
                readyCount={readyPlans.length}
              />
            }
          />
          <ActionCard
            eyebrow={`${readyDocumentation.length}/${projects.length} docs ready`}
            title="Prepare handoffs"
            description="Generate company context so onboarding and offboarding starts with the important details."
            href="/cto/documentation"
            action="Open docs"
            secondaryHref="/cto/documentation"
            secondaryAction="Review docs"
            icon={DocumentValidationIcon}
            visual={<DocsVisual readyCount={readyDocumentation.length} totalCount={projects.length} />}
          />
        </section>
      </div>
    </div>
  )
}

function ActionCard({
  eyebrow,
  title,
  description,
  href,
  action,
  secondaryHref,
  secondaryAction,
  icon,
  visual,
}: {
  eyebrow: string
  title: string
  description: string
  href: string
  action: string
  secondaryHref: string
  secondaryAction: string
  icon: typeof Folder01Icon
  visual: ReactNode
}) {
  return (
    <Card className={cn("min-h-[21.5rem] justify-between gap-4 p-4", overviewCardClass)}>
      <CardHeader className="gap-3 p-0">
        {visual}
        <Badge variant="outline" className="mb-2">
          {eyebrow}
        </Badge>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-0">
        <Button asChild>
          <Link href={href}>
            <HugeiconsIcon icon={icon} strokeWidth={2} data-icon="inline-start" />
            {action}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={secondaryHref}>
            <HugeiconsIcon
              icon={Add01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            {secondaryAction}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function ProjectVisual({ projects }: { projects: Project[] }) {
  const previewProjects = projects.slice(0, 5)

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", visualPanelClass)}>
      <div className="flex -space-x-4">
        {previewProjects.map((project, index) => (
          <Avatar
            key={project.id}
            className={cn(
              "size-12 bg-background ring-4 ring-background",
              index % 2 === 0 && "-translate-y-2",
              index % 2 === 1 && "translate-y-2"
            )}
          >
            <AvatarImage src={project.icon_url} alt="" />
            <AvatarFallback>{getInitials(project.project_name)}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <div className="flex gap-1.5">
        {previewProjects.slice(0, 4).map((project) => (
          <span key={project.id} className="size-1.5 rounded-full bg-border" />
        ))}
      </div>
    </div>
  )
}

function PeopleVisual({ names }: { names: string[] }) {
  return (
    <div className={cn("relative p-3", visualPanelClass)}>
      <div className="grid grid-cols-6 place-items-center gap-1.5">
        {names.slice(0, 12).map((name, index) => (
          <div
            key={`${name}-${index}`}
            className={cn(
              "flex size-7 items-center justify-center rounded-full bg-background text-[0.625rem] font-medium text-muted-foreground ring-1 ring-border",
              index % 4 === 0 && "translate-y-2",
              index % 4 === 2 && "-translate-y-2"
            )}
          >
            {getInitials(name)}
          </div>
        ))}
      </div>
      <div className="absolute bottom-3 left-3 h-1.5 w-20 rounded-full bg-border" />
    </div>
  )
}

function MatchingVisual({
  draftCount,
  activeCount,
  readyCount,
}: {
  draftCount: number
  activeCount: number
  readyCount: number
}) {
  return (
    <div className={cn("flex items-center gap-2 p-3", visualPanelClass)}>
      <FlowNode label="Draft" value={draftCount} />
      <FlowConnector active={activeCount + readyCount > 0} />
      <FlowNode label="Active" value={activeCount} />
      <FlowConnector active={readyCount > 0} />
      <FlowNode label="Ready" value={readyCount} />
    </div>
  )
}

function FlowNode({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center rounded-[calc(var(--radius-4xl)-1.5rem)] bg-background px-2 py-3 text-center ring-1 ring-border">
      <span className="text-lg font-semibold leading-none">{value}</span>
      <span className="mt-1 truncate text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function FlowConnector({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "h-px w-4 shrink-0",
        active ? "bg-foreground/50" : "bg-border"
      )}
    />
  )
}

function DocsVisual({
  readyCount,
  totalCount,
}: {
  readyCount: number
  totalCount: number
}) {
  const percent =
    totalCount > 0 ? Math.round((Math.min(readyCount, totalCount) / totalCount) * 100) : 0

  return (
    <div className={cn("relative flex items-center justify-center", visualPanelClass)}>
      <div className="absolute left-10 top-6 h-14 w-18 rotate-[-8deg] rounded-xl border border-border bg-background" />
      <div className="absolute right-10 top-7 h-14 w-18 rotate-[7deg] rounded-xl border border-border bg-background" />
      <div className="relative flex h-18 w-28 flex-col justify-between rounded-xl border border-border bg-background p-3">
        <div className="h-2 w-14 rounded-full bg-muted" />
        <div className="flex flex-col gap-1">
          <div className="h-1.5 w-full rounded-full bg-muted" />
          <div className="h-1.5 w-3/4 rounded-full bg-muted" />
        </div>
        <div className="text-xs font-medium text-muted-foreground">{percent}% ready</div>
      </div>
    </div>
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
