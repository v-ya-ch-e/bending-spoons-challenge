"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Add01Icon,
  ArrowRight01Icon,
  Edit02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { currentUser } from "@/data/mock-navigation"
import { runProjectMatching } from "@/lib/backend-api"
import {
  createMoveRequestsFromMatchingRecommendation,
  getCachedEmployees,
  getCachedProjects,
  listEmployees,
  listMatchingCandidates,
  listMatchingPolicies,
  listMatchingRecommendations,
  listMatchingRuns,
  listMoveRequests,
  listProjects,
  updateMoveRequest,
  updateProject,
  deleteMoveRequest,
  type MatchingPolicy,
  type MoveRequest,
  type MoveRequestStatus,
  type Project,
} from "@/lib/db-api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
import {
  buildMovePlans,
  formatImpact,
  formatLifecycle,
  formatRequestStatus,
  formatRequirement,
  getRequirementTotal,
  skillLabels,
  type AffectedCompanyImpact,
  type EmployeeTransitionImpact,
  type MatchingLifecycleState,
  type MatchingRunBundle,
  type MovePlan,
  type ProposedMovement,
  type RequirementCoverageRow,
} from "@/components/matching/matching-model"

type DetailSelection =
  | { kind: "requirement"; row: RequirementCoverageRow; plan: MovePlan }
  | { kind: "movement"; movement: ProposedMovement; plan: MovePlan }
  | { kind: "company"; company: AffectedCompanyImpact; plan: MovePlan }
  | { kind: "employee"; impact: EmployeeTransitionImpact; plan: MovePlan }
  | null

const lifecycleTabs: Array<{
  value: MatchingLifecycleState
  label: string
}> = [
  { value: "draft", label: "Drafts" },
  { value: "active", label: "Active requests" },
  { value: "ready", label: "Ready to execute" },
  { value: "completed", label: "Completed" },
]

export function MatchingScreen() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const cachedEmployees = getCachedEmployees()
  const cachedProjects = getCachedProjects()
  const [employees, setEmployees] = useState(() => cachedEmployees ?? [])
  const [projects, setProjects] = useState<Project[]>(() => cachedProjects ?? [])
  const [moveRequests, setMoveRequests] = useState<MoveRequest[]>([])
  const [policies, setPolicies] = useState<MatchingPolicy[]>([])
  const [runBundles, setRunBundles] = useState<MatchingRunBundle[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<MatchingLifecycleState>("draft")
  const [targetProjectId, setTargetProjectId] = useState("")
  const [policyId, setPolicyId] = useState("")
  const [detail, setDetail] = useState<DetailSelection>(null)
  const [isLoading, setIsLoading] = useState(() => !cachedEmployees || !cachedProjects)
  const [isGenerating, setIsGenerating] = useState(false)
  const [actionPlanId, setActionPlanId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const createDialogOpen = searchParams.get("create") === "1"

  const loadWorkspace = useCallback(async () => {
    try {
      if (!getCachedEmployees() || !getCachedProjects()) {
        setIsLoading(true)
      }
      setError(null)

      const [
        nextEmployees,
        nextProjects,
        nextMoveRequests,
        nextPolicies,
        matchingRuns,
      ] = await Promise.all([
        listEmployees(),
        listProjects(),
        listMoveRequests(),
        listMatchingPolicies(),
        listMatchingRuns(),
      ])
      const recentRuns = matchingRuns
        .filter((run) => run.use_case === "project_rebalance")
        .sort(
          (left, right) =>
            new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
        )
        .slice(0, 24)
      const nextRunBundles = await Promise.all(
        recentRuns.map(async (run) => {
          const [recommendations, candidates] = await Promise.all([
            listMatchingRecommendations(run.id),
            listMatchingCandidates(run.id),
          ])

          return { run, recommendations, candidates }
        })
      )

      setEmployees(nextEmployees)
      setProjects(nextProjects)
      setMoveRequests(nextMoveRequests)
      setPolicies(nextPolicies)
      setRunBundles(nextRunBundles)

      return {
        employees: nextEmployees,
        projects: nextProjects,
        moveRequests: nextMoveRequests,
        runBundles: nextRunBundles,
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load matching workspace."
      )
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadWorkspace()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadWorkspace])

  const plans = useMemo(
    () =>
      buildMovePlans({
        employees,
        projects,
        moveRequests,
        runBundles,
      }),
    [employees, moveRequests, projects, runBundles]
  )
  const visiblePlans = plans.filter((plan) => plan.lifecycle === activeTab)
  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ?? visiblePlans[0] ?? null
  const effectiveTargetProjectId = targetProjectId || String(projects[0]?.id ?? "")
  const effectivePolicyId =
    policyId || String(policies.find((policy) => policy.is_active)?.id ?? "")

  const metrics = useMemo(() => {
    return {
      drafts: plans.filter((plan) => plan.lifecycle === "draft").length,
      active: plans.filter((plan) => plan.lifecycle === "active").length,
      pendingApprovals: plans.reduce(
        (sum, plan) => sum + plan.pendingApprovalCount,
        0
      ),
      risky: plans.filter((plan) => plan.highestImpact !== "low").length,
    }
  }, [plans])

  function closeCreateDialog() {
    router.replace(pathname)
  }

  async function handleGeneratePlan() {
    if (!effectiveTargetProjectId) {
      return
    }

    setIsGenerating(true)
    setError(null)
    try {
      const response = await runProjectMatching(Number(effectiveTargetProjectId), {
        policy_id: effectivePolicyId ? Number(effectivePolicyId) : undefined,
        requested_by: currentUser.email,
      })
      await loadWorkspace()
      const candidatePlanId =
        response.summary.selected_candidate_plan_id ??
        response.suggestions[0]?.candidate_plan_id

      if (candidatePlanId) {
        setSelectedPlanId(`run-${response.run_id}-${candidatePlanId}`)
      }

      setActiveTab("draft")
      closeCreateDialog()
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Unable to generate a matching plan."
      )
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleRegenerate(plan: MovePlan) {
    setActionPlanId(plan.id)
    setError(null)
    try {
      const response = await runProjectMatching(plan.targetProject.id, {
        policy_id: effectivePolicyId ? Number(effectivePolicyId) : undefined,
        requested_by: currentUser.email,
      })
      await loadWorkspace()
      const candidatePlanId =
        response.summary.selected_candidate_plan_id ??
        response.suggestions[0]?.candidate_plan_id

      if (candidatePlanId) {
        setSelectedPlanId(`run-${response.run_id}-${candidatePlanId}`)
        setActiveTab("draft")
      }
    } catch (regenerateError) {
      setError(
        regenerateError instanceof Error
          ? regenerateError.message
          : "Unable to regenerate this plan."
      )
    } finally {
      setActionPlanId(null)
    }
  }

  async function handleStartRequest(plan: MovePlan) {
    if (!plan.run || !plan.recommendation) {
      return
    }

    setActionPlanId(plan.id)
    setError(null)
    try {
      await createMoveRequestsFromMatchingRecommendation(
        plan.run.id,
        plan.recommendation.candidate_plan_id
      )
      await loadWorkspace()
      setActiveTab("active")
      setSelectedPlanId(plan.id)
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Unable to start move request."
      )
    } finally {
      setActionPlanId(null)
    }
  }

  async function handleCancelRequest(plan: MovePlan) {
    setActionPlanId(plan.id)
    setError(null)
    try {
      await Promise.all(plan.requests.map((request) => deleteMoveRequest(request.id)))
      await loadWorkspace()
      setActiveTab(plan.origin === "recommendation" ? "draft" : "active")
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Unable to cancel this request."
      )
    } finally {
      setActionPlanId(null)
    }
  }

  async function handleRequestStatus(
    requestId: number,
    status: MoveRequestStatus,
    plan: MovePlan
  ) {
    setActionPlanId(plan.id)
    setError(null)
    try {
      await updateMoveRequest(requestId, { status })
      await loadWorkspace()
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to update request status."
      )
    } finally {
      setActionPlanId(null)
    }
  }

  async function handleExecutePlan(plan: MovePlan) {
    setActionPlanId(plan.id)
    setError(null)
    try {
      const projectUpdates = new Map(
        projects.map((project) => [
          project.id,
          new Set(project.current_team_member_ids),
        ])
      )

      for (const movement of plan.movements) {
        if (!movement.employee) {
          continue
        }

        projectUpdates
          .get(movement.targetProject.id)
          ?.add(movement.employee.id)

        if (movement.action === "move" && movement.sourceProject) {
          projectUpdates
            .get(movement.sourceProject.id)
            ?.delete(movement.employee.id)
        }
      }

      const changedProjects = projects.filter((project) => {
        const nextIds = [...(projectUpdates.get(project.id) ?? new Set<number>())].sort(
          (left, right) => left - right
        )
        const currentIds = [...project.current_team_member_ids].sort(
          (left, right) => left - right
        )
        return nextIds.join(",") !== currentIds.join(",")
      })

      await Promise.all(
        changedProjects.map((project) =>
          updateProject(project.id, {
            current_team_member_ids: [
              ...(projectUpdates.get(project.id) ?? new Set<number>()),
            ],
          })
        )
      )
      await loadWorkspace()
      setActiveTab("completed")
      setSelectedPlanId(plan.id)
    } catch (executeError) {
      setError(
        executeError instanceof Error
          ? executeError.message
          : "Unable to execute this plan."
      )
    } finally {
      setActionPlanId(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col gap-4 p-3 sm:p-4 lg:p-4">
      <MetricsStrip metrics={metrics} />

      {error && (
        <Alert variant="destructive">
          <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
          <AlertTitle>Matching workspace needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as MatchingLifecycleState)}
      >
        <TabsList>
          {lifecycleTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              <Badge variant="secondary">
                {plans.filter((plan) => plan.lifecycle === tab.value).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid min-h-[calc(100svh-13rem)] grid-cols-1 gap-4 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <MovePlanList
          plans={visiblePlans}
          selectedPlanId={selectedPlan?.id ?? null}
          isLoading={isLoading}
          onSelectPlan={setSelectedPlanId}
        />

        {isLoading ? (
          <WorkspaceSkeleton />
        ) : selectedPlan ? (
          <SelectedPlanWorkspace
            plan={selectedPlan}
            isBusy={actionPlanId === selectedPlan.id}
            onOpenDetail={setDetail}
            onRegenerate={handleRegenerate}
            onEditConstraints={(plan) => {
              setTargetProjectId(String(plan.targetProject.id))
              router.push(`${pathname}?create=1`)
            }}
            onStartRequest={handleStartRequest}
            onCancelRequest={handleCancelRequest}
            onExecutePlan={handleExecutePlan}
            onRequestStatus={handleRequestStatus}
            onOpenProject={() => router.push("/cto/projects")}
          />
        ) : (
          <EmptyWorkspace onCreate={() => router.push(`${pathname}?create=1`)} />
        )}
      </div>

      <CreatePlanDialog
        open={createDialogOpen}
        projects={projects}
        policies={policies}
        targetProjectId={effectiveTargetProjectId}
        policyId={effectivePolicyId}
        isGenerating={isGenerating}
        onOpenChange={(open) => {
          if (!open) closeCreateDialog()
        }}
        onTargetProjectChange={setTargetProjectId}
        onPolicyChange={setPolicyId}
        onGenerate={handleGeneratePlan}
      />

      <DetailSheet detail={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </div>
  )
}

function MetricsStrip({
  metrics,
}: {
  metrics: {
    drafts: number
    active: number
    pendingApprovals: number
    risky: number
  }
}) {
  const items = [
    { label: "draft plans", value: metrics.drafts },
    { label: "active requests", value: metrics.active },
    { label: "pending approvals", value: metrics.pendingApprovals },
    { label: "medium-risk plans", value: metrics.risky },
  ]

  return (
    <div className="grid gap-2 rounded-3xl border bg-card p-2 text-sm shadow-sm sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 rounded-2xl px-3 py-2">
          <span className="font-semibold">{item.value}</span>
          <span className="text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function MovePlanList({
  plans,
  selectedPlanId,
  isLoading,
  onSelectPlan,
}: {
  plans: MovePlan[]
  selectedPlanId: string | null
  isLoading: boolean
  onSelectPlan: (planId: string) => void
}) {
  return (
    <Card className="min-h-0" size="sm">
      <CardHeader>
        <CardTitle>Move plans</CardTitle>
        <CardDescription>Select a plan to review coverage and impact.</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 px-2">
        <ScrollArea className="h-[34rem]">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-3xl" />
              ))}
            </div>
          ) : plans.length > 0 ? (
            <div className="flex flex-col gap-2 p-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className={cn(
                    "rounded-3xl border p-3 text-left transition hover:bg-muted/60",
                    selectedPlanId === plan.id && "border-foreground bg-muted"
                  )}
                  onClick={() => onSelectPlan(plan.id)}
                >
                  <div className="flex items-start gap-3">
                    <ProjectLogo project={plan.targetProject} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium">{plan.title}</p>
                        <Badge variant="outline">{formatLifecycle(plan.lifecycle)}</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {plan.targetProject.project_name}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">
                          {plan.movements.length} moves
                        </span>
                        <ImpactBadge impact={plan.highestImpact} />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 text-sm text-muted-foreground">
              No plans in this lifecycle state.
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function SelectedPlanWorkspace({
  plan,
  isBusy,
  onOpenDetail,
  onRegenerate,
  onEditConstraints,
  onStartRequest,
  onCancelRequest,
  onExecutePlan,
  onRequestStatus,
  onOpenProject,
}: {
  plan: MovePlan
  isBusy: boolean
  onOpenDetail: (detail: DetailSelection) => void
  onRegenerate: (plan: MovePlan) => void
  onEditConstraints: (plan: MovePlan) => void
  onStartRequest: (plan: MovePlan) => void
  onCancelRequest: (plan: MovePlan) => void
  onExecutePlan: (plan: MovePlan) => void
  onRequestStatus: (
    requestId: number,
    status: MoveRequestStatus,
    plan: MovePlan
  ) => void
  onOpenProject: () => void
}) {
  return (
    <div className="min-w-0 rounded-4xl border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <ProjectLogo project={plan.targetProject} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold">{plan.title}</h1>
              <Badge variant="secondary">{formatLifecycle(plan.lifecycle)}</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {plan.summary}
            </p>
          </div>
        </div>

        <PlanActions
          plan={plan}
          isBusy={isBusy}
          onRegenerate={onRegenerate}
          onEditConstraints={onEditConstraints}
          onStartRequest={onStartRequest}
          onCancelRequest={onCancelRequest}
          onExecutePlan={onExecutePlan}
          onOpenProject={onOpenProject}
        />
      </div>

      <div className="flex flex-col gap-4 p-4">
        <SafetyNotice state={plan.lifecycle} />
        <SummaryStrip plan={plan} />

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <RequirementCoverageSection plan={plan} onOpenDetail={onOpenDetail} />
          <ProposedMovementsSection
            plan={plan}
            onOpenDetail={onOpenDetail}
            onRegenerate={onRegenerate}
            onRequestStatus={onRequestStatus}
          />
          <AffectedCompaniesSection plan={plan} onOpenDetail={onOpenDetail} />
          <EmployeeImpactSection plan={plan} onOpenDetail={onOpenDetail} />
        </div>
      </div>
    </div>
  )
}

function PlanActions({
  plan,
  isBusy,
  onRegenerate,
  onEditConstraints,
  onStartRequest,
  onCancelRequest,
  onExecutePlan,
  onOpenProject,
}: {
  plan: MovePlan
  isBusy: boolean
  onRegenerate: (plan: MovePlan) => void
  onEditConstraints: (plan: MovePlan) => void
  onStartRequest: (plan: MovePlan) => void
  onCancelRequest: (plan: MovePlan) => void
  onExecutePlan: (plan: MovePlan) => void
  onOpenProject: () => void
}) {
  if (plan.lifecycle === "draft") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={() => onRegenerate(plan)}
        >
          Regenerate
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={() => onEditConstraints(plan)}
        >
          <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} data-icon="inline-start" />
          Edit constraints
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isBusy || !plan.run || !plan.recommendation}
          onClick={() => onStartRequest(plan)}
        >
          Start move request
        </Button>
      </div>
    )
  }

  if (plan.lifecycle === "active") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled>
          Send reminder
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={() => onRegenerate(plan)}
        >
          Find replacement
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isBusy}
          onClick={() => onCancelRequest(plan)}
        >
          Cancel request
        </Button>
      </div>
    )
  }

  if (plan.lifecycle === "ready") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled>
          Schedule transition
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isBusy}
          onClick={() => onExecutePlan(plan)}
        >
          Start transition
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onOpenProject}>
        Open company workspace
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isBusy}
        onClick={() => onRegenerate(plan)}
      >
        Duplicate plan
      </Button>
    </div>
  )
}

function SafetyNotice({ state }: { state: MatchingLifecycleState }) {
  const copy: Record<MatchingLifecycleState, string> = {
    draft: "Nothing has been sent to employees yet. Review impact before starting the request.",
    active: "Requests have been sent. Track employee responses before executing the transition.",
    ready: "All required moves have been accepted. The transition can now be scheduled.",
    completed: "Moves are complete. Requirements should be covered in current staffing records.",
  }

  return (
    <Alert>
      <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
      <AlertTitle>{formatLifecycle(state)} plan</AlertTitle>
      <AlertDescription>{copy[state]}</AlertDescription>
    </Alert>
  )
}

function SummaryStrip({ plan }: { plan: MovePlan }) {
  const items = [
    { label: "Target company", value: plan.targetProject.project_name },
    { label: "Proposed moves", value: String(plan.movements.length) },
    { label: "Requirement coverage", value: `${plan.coveragePercent}%` },
    { label: "Highest source impact", value: formatImpact(plan.highestImpact) },
  ]

  return (
    <div className="grid gap-2 rounded-3xl border bg-background p-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl px-3 py-2">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-1 truncate font-medium">{item.value}</p>
        </div>
      ))}
    </div>
  )
}

function RequirementCoverageSection({
  plan,
  onOpenDetail,
}: {
  plan: MovePlan
  onOpenDetail: (detail: DetailSelection) => void
}) {
  return (
    <WorkspaceSection title="1. Requirement coverage">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Skill</TableHead>
            <TableHead>Required</TableHead>
            <TableHead>Current</TableHead>
            <TableHead>After plan</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plan.requirementCoverage.map((row) => (
            <TableRow
              key={row.skill}
              className="cursor-pointer"
              onClick={() => onOpenDetail({ kind: "requirement", row, plan })}
            >
              <TableCell>{skillLabels[row.skill]}</TableCell>
              <TableCell>
                {formatRequirement(plan.targetProject.required_skills[row.skill]) ||
                  "Not required"}
              </TableCell>
              <TableCell>
                {row.currentCovered} / {row.requiredSlots}
              </TableCell>
              <TableCell>
                {row.afterCovered} / {row.requiredSlots}
              </TableCell>
              <TableCell>
                <CoverageBadge status={row.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </WorkspaceSection>
  )
}

function ProposedMovementsSection({
  plan,
  onOpenDetail,
  onRegenerate,
  onRequestStatus,
}: {
  plan: MovePlan
  onOpenDetail: (detail: DetailSelection) => void
  onRegenerate: (plan: MovePlan) => void
  onRequestStatus: (
    requestId: number,
    status: MoveRequestStatus,
    plan: MovePlan
  ) => void
}) {
  return (
    <WorkspaceSection title="2. Proposed movements">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>From - To</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Covers</TableHead>
            <TableHead>Impact</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plan.movements.map((movement) => (
            <TableRow
              key={movement.id}
              className="cursor-pointer"
              onClick={() => onOpenDetail({ kind: "movement", movement, plan })}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar>
                    <AvatarFallback>
                      {getInitials(movement.employee?.name ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">
                    {movement.employee?.name ?? "Unknown employee"}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span>{movement.sourceProject?.project_name ?? "Bench"}</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                  <span>{movement.targetProject.project_name}</span>
                </div>
              </TableCell>
              <TableCell>{movement.expectedRole}</TableCell>
              <TableCell>
                <span className="text-muted-foreground">
                  {movement.requirementsCovered.join(", ")}
                </span>
              </TableCell>
              <TableCell>
                <ImpactBadge impact={movement.currentProjectImpact} />
              </TableCell>
              <TableCell>
                <RequestStatusBadge status={movement.requestStatus} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {movement.request && plan.lifecycle === "active" && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={(event) => {
                          event.stopPropagation()
                          onRequestStatus(movement.request!.id, "accepted", plan)
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={(event) => {
                          event.stopPropagation()
                          onRequestStatus(movement.request!.id, "rejected", plan)
                        }}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRegenerate(plan)
                    }}
                  >
                    Replace
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </WorkspaceSection>
  )
}

function AffectedCompaniesSection({
  plan,
  onOpenDetail,
}: {
  plan: MovePlan
  onOpenDetail: (detail: DetailSelection) => void
}) {
  return (
    <WorkspaceSection title="3. Affected companies">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Losing</TableHead>
            <TableHead>After coverage</TableHead>
            <TableHead>Risk</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plan.affectedCompanies.length > 0 ? (
            plan.affectedCompanies.map((company) => (
              <TableRow
                key={company.project?.id ?? "bench"}
                className="cursor-pointer"
                onClick={() => onOpenDetail({ kind: "company", company, plan })}
              >
                <TableCell>{company.project?.project_name ?? "Bench"}</TableCell>
                <TableCell>
                  {company.lostEmployees.map((employee) => employee.name).join(", ")}
                </TableCell>
                <TableCell>
                  {company.afterHeadcount} / {company.requiredHeadcount} people
                </TableCell>
                <TableCell>
                  <ImpactBadge impact={company.risk} />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                No source company loses capacity.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </WorkspaceSection>
  )
}

function EmployeeImpactSection({
  plan,
  onOpenDetail,
}: {
  plan: MovePlan
  onOpenDetail: (detail: DetailSelection) => void
}) {
  return (
    <WorkspaceSection title="4. Employee impact">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Transition effort</TableHead>
            <TableHead>Handoff</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plan.employeeImpacts.map((impact) => (
            <TableRow
              key={impact.movement.id}
              className="cursor-pointer"
              onClick={() => onOpenDetail({ kind: "employee", impact, plan })}
            >
              <TableCell>{impact.employee?.name ?? "Unknown employee"}</TableCell>
              <TableCell>{impact.transitionEffort}</TableCell>
              <TableCell className="max-w-72">
                <span className="block truncate text-muted-foreground">
                  {impact.handoffNeeds}
                </span>
              </TableCell>
              <TableCell>
                <RequestStatusBadge status={impact.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </WorkspaceSection>
  )
}

function WorkspaceSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="min-w-0 rounded-3xl border bg-background">
      <div className="border-b px-4 py-3">
        <h2 className="font-medium">{title}</h2>
      </div>
      <div>{children}</div>
    </section>
  )
}

function CreatePlanDialog({
  open,
  projects,
  policies,
  targetProjectId,
  policyId,
  isGenerating,
  onOpenChange,
  onTargetProjectChange,
  onPolicyChange,
  onGenerate,
}: {
  open: boolean
  projects: Project[]
  policies: MatchingPolicy[]
  targetProjectId: string
  policyId: string
  isGenerating: boolean
  onOpenChange: (open: boolean) => void
  onTargetProjectChange: (projectId: string) => void
  onPolicyChange: (policyId: string) => void
  onGenerate: () => void
}) {
  const targetProject = projects.find((project) => String(project.id) === targetProjectId)
  const policy = policies.find((item) => String(item.id) === policyId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create move plan</DialogTitle>
          <DialogDescription>
            Generate a draft from API-backed project requirements and matching policy.
            Nothing is sent to employees until the draft request is started.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="target-project">
              Target company
            </label>
            <Select value={targetProjectId} onValueChange={onTargetProjectChange}>
              <SelectTrigger id="target-project">
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.project_name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="matching-policy">
              Constraints policy
            </label>
            <Select value={policyId} onValueChange={onPolicyChange}>
              <SelectTrigger id="matching-policy">
                <SelectValue placeholder="Select policy" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {policies.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {targetProject && (
          <div className="rounded-3xl border bg-background p-4">
            <div className="flex items-center gap-3">
              <ProjectLogo project={targetProject} />
              <div>
                <p className="font-medium">{targetProject.project_name}</p>
                <p className="text-sm text-muted-foreground">
                  {targetProject.required_people_amount} people required
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {Object.entries(targetProject.required_skills)
                .filter(([, requirement]) => getRequirementTotal(requirement) > 0)
                .map(([skill, requirement]) => (
                  <Badge key={skill} variant="secondary">
                    {skillLabels[skill as keyof typeof skillLabels]}{" "}
                    {formatRequirement(requirement)}
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {policy && (
          <Alert>
            <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
            <AlertTitle>{policy.name}</AlertTitle>
            <AlertDescription>
              {policy.description ?? "This active API policy controls matching constraints."}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!targetProjectId || isGenerating}
            onClick={onGenerate}
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            {isGenerating ? "Generating..." : "Generate draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailSheet({
  detail,
  onOpenChange,
}: {
  detail: DetailSelection
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={Boolean(detail)} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{getDetailTitle(detail)}</SheetTitle>
          <SheetDescription>
            What this item is, why it matters, current status, and next action.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 overflow-y-auto px-6 pb-6">
          {detail && <DetailContent detail={detail} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DetailContent({ detail }: { detail: NonNullable<DetailSelection> }) {
  if (detail.kind === "requirement") {
    const requirement = detail.plan.targetProject.required_skills[detail.row.skill]
    return (
      <>
        <DetailBlock label="What is this?">
          {skillLabels[detail.row.skill]} staffing requirement for{" "}
          {detail.plan.targetProject.project_name}.
        </DetailBlock>
        <DetailBlock label="Why it matters?">
          The plan is useful only if it closes target company minimum requirements.
        </DetailBlock>
        <DetailBlock label="Current status">
          {formatRequirement(requirement) || "Not required"}; after plan coverage is{" "}
          {detail.row.afterCovered} / {detail.row.requiredSlots}.
        </DetailBlock>
        <DetailBlock label="Next action">
          Review proposed movements covering this requirement before starting requests.
        </DetailBlock>
        <TokenList
          label="Covering employees"
          items={detail.row.coveringEmployees.map((employee) => employee.name)}
        />
      </>
    )
  }

  if (detail.kind === "movement") {
    return (
      <>
        <DetailBlock label="What is this?">
          {detail.movement.employee?.name ?? "Unknown employee"} moving from{" "}
          {detail.movement.sourceProject?.project_name ?? "Bench"} to{" "}
          {detail.movement.targetProject.project_name}.
        </DetailBlock>
        <DetailBlock label="Why it matters?">{detail.movement.reason}</DetailBlock>
        <DetailBlock label="Current status">
          {formatRequestStatus(detail.movement.requestStatus)}
        </DetailBlock>
        <DetailBlock label="Next action">
          {detail.plan.lifecycle === "draft"
            ? "Start the move request when the plan has been reviewed."
            : "Track the employee response before executing the transition."}
        </DetailBlock>
        <TokenList label="Requirements covered" items={detail.movement.requirementsCovered} />
      </>
    )
  }

  if (detail.kind === "company") {
    return (
      <>
        <DetailBlock label="What is this?">
          Source company impact for {detail.company.project?.project_name ?? "Bench"}.
        </DetailBlock>
        <DetailBlock label="Why it matters?">
          This checks whether solving {detail.plan.targetProject.project_name} creates
          a staffing problem elsewhere.
        </DetailBlock>
        <DetailBlock label="Current status">
          {detail.company.afterHeadcount} / {detail.company.requiredHeadcount} people
          after plan, {formatImpact(detail.company.risk)} risk.
        </DetailBlock>
        <DetailBlock label="Next action">
          Inspect lost employees and regenerate if the source risk is unacceptable.
        </DetailBlock>
        <TokenList
          label="Losing employees"
          items={detail.company.lostEmployees.map((employee) => employee.name)}
        />
      </>
    )
  }

  return (
    <>
      <DetailBlock label="What is this?">
        Employee transition impact for {detail.impact.employee?.name ?? "Unknown employee"}.
      </DetailBlock>
      <DetailBlock label="Why it matters?">
        Capacity planning should account for handoff and onboarding work, not only skill
        fit.
      </DetailBlock>
      <DetailBlock label="Current status">
        {formatRequestStatus(detail.impact.status)}; transition effort{" "}
        {detail.impact.transitionEffort}.
      </DetailBlock>
      <DetailBlock label="Next action">{detail.impact.handoffNeeds}</DetailBlock>
    </>
  )
}

function DetailBlock({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  )
}

function TokenList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.length > 0 ? (
          items.map((item) => (
            <Badge key={item} variant="outline">
              {item}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">None</span>
        )}
      </div>
    </div>
  )
}

function EmptyWorkspace({ onCreate }: { onCreate: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No move plan selected</CardTitle>
        <CardDescription>
          Generate a draft from project requirements and API matching policy.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" onClick={onCreate}>
          Create move plan
        </Button>
      </CardContent>
    </Card>
  )
}

function WorkspaceSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-4xl border bg-card p-4">
      <Skeleton className="h-20 rounded-3xl" />
      <Skeleton className="h-24 rounded-3xl" />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-52 rounded-3xl" />
        ))}
      </div>
    </div>
  )
}

function CoverageBadge({
  status,
}: {
  status: RequirementCoverageRow["status"]
}) {
  const labels: Record<RequirementCoverageRow["status"], string> = {
    covered: "Covered",
    partially_covered: "Partial",
    missing: "Missing",
    not_required: "Not required",
  }

  return (
    <Badge
      variant={
        status === "missing"
          ? "destructive"
          : status === "covered"
            ? "secondary"
            : "outline"
      }
    >
      {labels[status]}
    </Badge>
  )
}

function ImpactBadge({ impact }: { impact: "low" | "medium" | "high" }) {
  return (
    <Badge variant={impact === "high" ? "destructive" : "outline"}>
      {formatImpact(impact)} risk
    </Badge>
  )
}

function RequestStatusBadge({
  status,
}: {
  status: MoveRequestStatus | "not_sent"
}) {
  return (
    <Badge
      variant={
        status === "rejected"
          ? "destructive"
          : status === "accepted"
            ? "secondary"
            : "outline"
      }
    >
      {formatRequestStatus(status)}
    </Badge>
  )
}

function ProjectLogo({
  project,
  size = "default",
}: {
  project: Project
  size?: "default" | "lg"
}) {
  return (
    <Avatar className={cn(size === "lg" && "size-12")}>
      <AvatarImage src={project.icon_url} alt="" />
      <AvatarFallback>{getInitials(project.project_name)}</AvatarFallback>
    </Avatar>
  )
}

function getInitials(value: string) {
  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function getDetailTitle(detail: DetailSelection) {
  if (!detail) return "Details"
  if (detail.kind === "requirement") return `${skillLabels[detail.row.skill]} requirement`
  if (detail.kind === "movement") {
    return detail.movement.employee?.name ?? "Proposed movement"
  }
  if (detail.kind === "company") {
    return detail.company.project?.project_name ?? "Affected company"
  }
  return detail.impact.employee?.name ?? "Employee impact"
}
