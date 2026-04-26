"use client"

import { useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"

import type { Employee, Project, SkillKey } from "@/lib/db-api"
import {
  computeCompanyGaps,
  computeProjectGaps,
  countSkillExperts,
  rankHireNext,
  skillKeys,
  skillRoleTitles,
  skillTitles,
  type CompanyGap,
} from "@/lib/overview/skills-gaps"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
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

const tabs = [
  { value: "company", label: "Company" },
  { value: "per-project", label: "Per project" },
  { value: "risks", label: "Risks" },
  { value: "hire-next", label: "Hire next" },
] as const

type TabValue = (typeof tabs)[number]["value"]

const phaseDotColors: Record<Project["project_phase"], string> = {
  growth: "#10B981",
  maintenance: "#64748B",
  "new acquisition": "#7C3AED",
}

const phaseLabels: Record<Project["project_phase"], string> = {
  growth: "Growth",
  maintenance: "Maintenance",
  "new acquisition": "New acquisition",
}

type SkillsGapsProps = {
  projects: Project[]
  employees: Employee[]
  onProjectOpen: (projectId: number) => void
}

export function SkillsGaps({
  projects,
  employees,
  onProjectOpen,
}: SkillsGapsProps) {
  const [tab, setTab] = useState<TabValue>("company")

  const companyGaps = useMemo(
    () => computeCompanyGaps(projects, employees),
    [projects, employees]
  )

  const projectGaps = useMemo(
    () =>
      projects
        .map((project) => computeProjectGaps(project, employees))
        .filter((entry) => entry.totalGap > 0)
        .sort((left, right) => right.totalGap - left.totalGap),
    [projects, employees]
  )

  const hireSuggestions = useMemo(
    () => rankHireNext(companyGaps),
    [companyGaps]
  )

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Skills gaps
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Where the company is short and who to hire next.
          </p>
        </div>
        <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)}>
          <TabsList>
            {tabs.map((entry) => (
              <TabsTrigger key={entry.value} value={entry.value}>
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {tab === "company" && <CompanyView companyGaps={companyGaps} />}
      {tab === "per-project" && (
        <PerProjectView
          projectGaps={projectGaps}
          onProjectOpen={onProjectOpen}
        />
      )}
      {tab === "risks" && <RisksView employees={employees} />}
      {tab === "hire-next" && <HireNextView suggestions={hireSuggestions} />}
    </section>
  )
}

function CompanyView({ companyGaps }: { companyGaps: CompanyGap[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {companyGaps.map(({ skill, gap }) => (
        <div
          key={skill}
          className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-4"
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {skillTitles[skill]}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {gap.total} unmet
            </span>
          </div>
          {gap.total === 0 ? (
            <span className="text-xs text-muted-foreground">All covered</span>
          ) : (
            <div className="flex flex-col gap-1.5">
              {gap.l3 > 0 && <LevelPill level={3} count={gap.l3} />}
              {gap.l2 > 0 && <LevelPill level={2} count={gap.l2} />}
              {gap.l1 > 0 && <LevelPill level={1} count={gap.l1} />}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PerProjectView({
  projectGaps,
  onProjectOpen,
}: {
  projectGaps: ReturnType<typeof computeProjectGaps>[]
  onProjectOpen: (projectId: number) => void
}) {
  if (projectGaps.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
        Every project meets its skill requirements.
      </p>
    )
  }

  return (
    <ScrollArea className="max-h-96 rounded-2xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Phase</TableHead>
            <TableHead>Missing skills</TableHead>
            <TableHead className="text-right">Open</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projectGaps.map(({ project, gaps }) => (
            <TableRow
              key={project.id}
              className="cursor-pointer"
              onClick={() => onProjectOpen(project.id)}
            >
              <TableCell className="min-w-0">
                <span className="truncate font-medium text-foreground">
                  {project.project_name}
                </span>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{
                      backgroundColor: phaseDotColors[project.project_phase],
                    }}
                  />
                  {phaseLabels[project.project_phase]}
                </span>
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="inline-flex flex-wrap gap-1.5">
                  {gaps.map(({ skill, gap }) => (
                    <SkillGapPills key={skill} skill={skill} gap={gap} />
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation()
                    onProjectOpen(project.id)
                  }}
                >
                  Open
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    strokeWidth={2}
                    className="size-3"
                  />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}

function RisksView({ employees }: { employees: Employee[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {skillKeys.map((skill) => {
        const { count, experts } = countSkillExperts(employees, skill)
        const isFragile = count <= 2

        return (
          <div
            key={skill}
            className={cn(
              "flex flex-col gap-2 rounded-2xl border p-4",
              isFragile
                ? "border-[#EF4444]/40 bg-[#EF4444]/5"
                : "border-border bg-background"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {skillTitles[skill]}
              </span>
              {isFragile && (
                <HugeiconsIcon
                  icon={Alert02Icon}
                  strokeWidth={2}
                  className="size-4 text-[#EF4444]"
                />
              )}
            </div>
            {isFragile ? (
              <p className="text-xs font-medium text-[#EF4444]">
                Bus factor {count} — single point of failure
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Bus factor {count}
              </p>
            )}
            {experts.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {experts.map((expert) => expert.name).join(", ")}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function HireNextView({
  suggestions,
}: {
  suggestions: ReturnType<typeof rankHireNext>
}) {
  if (suggestions.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
        No hires recommended right now — every skill is covered.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {suggestions.map((suggestion, index) => (
        <li
          key={suggestion.skill}
          className="flex items-center gap-4 rounded-2xl border border-border bg-background p-4"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-sm font-semibold text-background tabular-nums">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {capitalize(skillRoleTitles[suggestion.skill])}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {suggestion.level} · closes {suggestion.slotsClosed}{" "}
              {suggestion.slotsClosed === 1 ? "slot" : "slots"}
            </p>
          </div>
          <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
            <SkillGapPills skill={suggestion.skill} gap={suggestion.gap} hideSkill />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            Open hiring brief
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              className="size-3"
            />
          </Button>
        </li>
      ))}
    </ul>
  )
}

function LevelPill({ level, count }: { level: 1 | 2 | 3; count: number }) {
  const styles = {
    3: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20",
    2: "bg-[#F59E0B]/10 text-[#B45309] border-[#F59E0B]/30 dark:text-[#F59E0B]",
    1: "bg-zinc-200/60 text-zinc-700 border-zinc-300/70 dark:bg-zinc-800/60 dark:text-zinc-200 dark:border-zinc-700",
  }[level]

  return (
    <span
      className={cn(
        "inline-flex items-center justify-between gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums",
        styles
      )}
    >
      <span>L{level}</span>
      <span>×{count}</span>
    </span>
  )
}

function SkillGapPills({
  skill,
  gap,
  hideSkill,
}: {
  skill: SkillKey
  gap: { l1: number; l2: number; l3: number }
  hideSkill?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs">
      {!hideSkill && (
        <span className="font-medium text-foreground">
          {skillTitles[skill]}
        </span>
      )}
      <span className="inline-flex items-center gap-0.5">
        {gap.l3 > 0 && (
          <span className="rounded-full bg-[#EF4444]/15 px-1.5 text-[#EF4444] tabular-nums">
            L3×{gap.l3}
          </span>
        )}
        {gap.l2 > 0 && (
          <span className="rounded-full bg-[#F59E0B]/15 px-1.5 text-[#B45309] tabular-nums dark:text-[#F59E0B]">
            L2×{gap.l2}
          </span>
        )}
        {gap.l1 > 0 && (
          <span className="rounded-full bg-zinc-200/60 px-1.5 text-zinc-700 tabular-nums dark:bg-zinc-800/60 dark:text-zinc-200">
            L1×{gap.l1}
          </span>
        )}
      </span>
    </span>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
