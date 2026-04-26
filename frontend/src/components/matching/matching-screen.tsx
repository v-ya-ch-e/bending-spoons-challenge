"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowRight01Icon,
  Edit02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { currentUser } from "@/data/mock-navigation"
import { approveMoveRequest, runProjectMatching } from "@/lib/backend-api"
import {
  createMoveRequestsFromMatchingRecommendation,
  deleteMatchingRun,
  deleteMoveRequest,
  getCachedEmployees,
  getCachedProjects,
  getMatchingRun,
  listEmployees,
  listMatchingCandidates,
  listMatchingPolicies,
  listMatchingRecommendations,
  listMatchingRuns,
  listMoveRequests,
  listProjects,
  updateMatchingRun,
  updateMoveRequest,
  type ImpactLevel,
  type MatchingPolicy,
  type MoveRequest,
  type MoveRequestStatus,
  type MoveRequestUpdateInput,
  type Project,
} from "@/lib/db-api"
import type { MatchingInitialData } from "@/lib/server/db-api"
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
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { CreateMatchingDialog } from "@/components/matching/create-matching-dialog"
import {
  buildMovePlans,
  formatImpact,
  formatRequestStatus,
  formatRequirement,
  getCreateFlowMetadata,
  skillLabels,
  type AffectedCompanyImpact,
  type EmployeeTransitionImpact,
  type MatchingLifecycleState,
  type MatchingRunBundle,
  type MovePlan,
  type ProposedMovement,
  type RequirementCoverageRow,
} from "@/components/matching/matching-model"
import { getEmployeeAvatarSrc } from "@/lib/employee-avatars"

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
  { value: "ready", label: "Transitioning" },
  { value: "completed", label: "Completed" },
]

export function MatchingScreen({
  initialData,
}: {
  initialData?: MatchingInitialData | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const cachedEmployees = getCachedEmployees()
  const cachedProjects = getCachedProjects()
  const [employees, setEmployees] = useState(
    () => initialData?.employees ?? cachedEmployees ?? []
  )
  const [projects, setProjects] = useState<Project[]>(
    () => initialData?.projects ?? cachedProjects ?? []
  )
  const [moveRequests, setMoveRequests] = useState<MoveRequest[]>(
    () => initialData?.moveRequests ?? []
  )
  const [policies, setPolicies] = useState<MatchingPolicy[]>(
    () => initialData?.policies ?? []
  )
  const [runBundles, setRunBundles] = useState<MatchingRunBundle[]>(
    () => initialData?.runBundles ?? []
  )
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<MatchingLifecycleState>("draft")
  const [createTargetProjectId, setCreateTargetProjectId] = useState("")
  const [detail, setDetail] = useState<DetailSelection>(null)
  const [isLoading, setIsLoading] = useState(() => !initialData)
  const [actionPlanId, setActionPlanId] = useState<string | null>(null)
  const [overridePlan, setOverridePlan] = useState<MovePlan | null>(null)
  const [overrideReason, setOverrideReason] = useState("")
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [deletePlanTarget, setDeletePlanTarget] = useState<MovePlan | null>(null)
  const [editPlanTarget, setEditPlanTarget] = useState<MovePlan | null>(null)
  const [editMoveContext, setEditMoveContext] = useState<{
    plan: MovePlan
    movement: ProposedMovement
  } | null>(null)
  const [deleteMoveContext, setDeleteMoveContext] = useState<{
    plan: MovePlan
    movement: ProposedMovement
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const createDialogOpen = searchParams.get("create") === "1"

  const loadWorkspace = useCallback(async () => {
    try {
      setIsLoading(true)
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
        listMatchingRuns({ force: true }),
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
    if (initialData) {
      return
    }

    const timeout = window.setTimeout(() => {
      loadWorkspace()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [initialData, loadWorkspace])

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
  const effectivePolicyId =
    String(policies.find((policy) => policy.is_active)?.id ?? "")
  const effectiveCreateTargetProjectId =
    createTargetProjectId || String(projects[0]?.id ?? "")

  function closeCreateDialog() {
    router.replace(pathname)
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

  async function handleConfirmDeletePlan() {
    const plan = deletePlanTarget
    if (!plan) return

    setActionPlanId(plan.id)
    setError(null)
    try {
      if (plan.requests.length > 0) {
        await Promise.all(plan.requests.map((request) => deleteMoveRequest(request.id)))
      }
      if (plan.run) {
        await deleteMatchingRun(plan.run.id)
      }
      await loadWorkspace()
      setDeletePlanTarget(null)
      setDetail((current) => (current?.plan.id === plan.id ? null : current))
      setSelectedPlanId(null)
      setActiveTab(
        plan.lifecycle === "completed"
          ? "completed"
          : plan.origin === "recommendation"
            ? "draft"
            : "active"
      )
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete this plan."
      )
    } finally {
      setActionPlanId(null)
    }
  }

  async function handleSaveEditPlan(planName: string, goal: string) {
    const plan = editPlanTarget
    if (!plan?.run) {
      setEditPlanTarget(null)
      return
    }

    setActionPlanId(plan.id)
    setError(null)
    try {
      const fresh = await getMatchingRun(plan.run.id)
      const priorMeta = getCreateFlowMetadata(fresh) ?? {}
      await updateMatchingRun(plan.run.id, {
        input_snapshot: {
          ...(fresh.input_snapshot ?? {}),
          matching_create_flow: {
            ...priorMeta,
            planName: planName.trim(),
            goal: goal.trim(),
          },
        },
      })
      await loadWorkspace()
      setEditPlanTarget(null)
    } catch (editPlanError) {
      setError(
        editPlanError instanceof Error
          ? editPlanError.message
          : "Unable to update this plan."
      )
    } finally {
      setActionPlanId(null)
    }
  }

  async function handleSaveEditMoveRequest(payload: MoveRequestUpdateInput) {
    const context = editMoveContext
    if (!context?.movement.request) {
      setEditMoveContext(null)
      return
    }

    setActionPlanId(context.plan.id)
    setError(null)
    try {
      await updateMoveRequest(context.movement.request.id, payload)
      await loadWorkspace()
      setEditMoveContext(null)
      setDetail(null)
    } catch (editMoveError) {
      setError(
        editMoveError instanceof Error
          ? editMoveError.message
          : "Unable to update this move request."
      )
    } finally {
      setActionPlanId(null)
    }
  }

  async function handleConfirmDeleteMoveRequest() {
    const context = deleteMoveContext
    if (!context?.movement.request) {
      setDeleteMoveContext(null)
      return
    }

    setActionPlanId(context.plan.id)
    setError(null)
    try {
      await deleteMoveRequest(context.movement.request.id)
      await loadWorkspace()
      setDeleteMoveContext(null)
      setDetail((current) =>
        current?.plan.id === context.plan.id &&
        (current.kind === "movement" || current.kind === "employee")
          ? null
          : current
      )
    } catch (deleteMoveError) {
      setError(
        deleteMoveError instanceof Error
          ? deleteMoveError.message
          : "Unable to delete this move request."
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
      if (status === "accepted") {
        await approveMoveRequest(requestId, "cto", "approved")
      } else if (status === "rejected") {
        await approveMoveRequest(requestId, "cto", "rejected")
      } else {
        await updateMoveRequest(requestId, { status })
      }
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

  function openOverrideDialog(plan: MovePlan) {
    setOverridePlan(plan)
    setOverrideReason("")
    setOverrideError(null)
  }

  async function handleForceApproveAndExecute() {
    if (!overridePlan) return
    const reason = overrideReason.trim()
    if (!reason) {
      setOverrideError("Enter the reason for bypassing employee confirmation.")
      return
    }

    setActionPlanId(overridePlan.id)
    setError(null)
    setOverrideError(null)
    try {
      const requestsToForce = overridePlan.requests.filter(
        (request) =>
          request.status !== "transition_started" && request.status !== "completed"
      )
      await Promise.all(
        requestsToForce.map(async (request) => {
          await updateMoveRequest(request.id, {
            status: "accepted",
            reason: `${request.reason}\n\nCTO override: ${reason}`,
          })
          await approveMoveRequest(request.id, "cto", "approved")
          await approveMoveRequest(request.id, "employee", "approved")
        })
      )

      if (overridePlan.run) {
        await updateMatchingRun(overridePlan.run.id, {
          input_snapshot: {
            ...(overridePlan.run.input_snapshot ?? {}),
            cto_override: {
              reason,
              requestedBy: currentUser.email,
              forcedRequestIds: requestsToForce.map((request) => request.id),
              createdAt: new Date().toISOString(),
            },
          },
        })
      }

      await loadWorkspace()
      setActiveTab("ready")
      setSelectedPlanId(overridePlan.id)
      setOverridePlan(null)
      setOverrideReason("")
    } catch (overrideFailure) {
      setError(
        overrideFailure instanceof Error
          ? overrideFailure.message
          : "Unable to force approve and start this transition."
      )
    } finally {
      setActionPlanId(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 bg-background p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">Matching</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create move plans, review staffing coverage, and coordinate approved
            employee transitions.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
          <AlertTitle>Matching workspace needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <LifecycleTabs
        activeTab={activeTab}
        isLoading={isLoading}
        plans={plans}
        onTabChange={setActiveTab}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[21rem_minmax(0,1fr)]">
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
              setCreateTargetProjectId(String(plan.targetProject.id))
              router.push(`${pathname}?create=1`)
            }}
            onEditPlan={setEditPlanTarget}
            onDeletePlan={setDeletePlanTarget}
            onEditMoveRequest={(plan, movement) => {
              setEditMoveContext({ plan, movement })
            }}
            onDeleteMoveRequest={(plan, movement) => {
              setDeleteMoveContext({ plan, movement })
            }}
            onStartRequest={handleStartRequest}
            onCancelRequest={handleCancelRequest}
            onForceExecute={openOverrideDialog}
            onRequestStatus={handleRequestStatus}
            onOpenProject={() => router.push("/cto/projects")}
          />
        ) : (
          <EmptyWorkspace onCreate={() => router.push(`${pathname}?create=1`)} />
        )}
      </div>

      {createDialogOpen && (
        <CreateMatchingDialog
          open={createDialogOpen}
          employees={employees}
          projects={projects}
          policies={policies}
          initialTargetProjectId={effectiveCreateTargetProjectId}
          initialPolicyId={effectivePolicyId}
          requestedBy={currentUser.email}
          onOpenChange={(open) => {
            if (!open) closeCreateDialog()
          }}
          onCreated={async ({ runId, candidatePlanId }) => {
            const workspace = await loadWorkspace()
            if (!workspace) {
              return false
            }

            const createdPlan = findCreatedDraftPlan({
              plans: buildMovePlans({
                employees: workspace.employees,
                projects: workspace.projects,
                moveRequests: workspace.moveRequests,
                runBundles: workspace.runBundles,
              }),
              runId,
              candidatePlanId,
            })
            if (!createdPlan) {
              setError("The matching run completed, but no draft plan was created.")
              return false
            }

            setSelectedPlanId(createdPlan.id)
            setActiveTab("draft")
            closeCreateDialog()
            return true
          }}
        />
      )}

      <DetailSheet
        detail={detail}
        isBusy={Boolean(detail && actionPlanId === detail.plan.id)}
        onOpenChange={(open) => !open && setDetail(null)}
        onRegenerate={handleRegenerate}
        onStartRequest={handleStartRequest}
        onRequestStatus={handleRequestStatus}
        onForceExecute={openOverrideDialog}
        onEditMoveRequest={(plan, movement) => {
          setEditMoveContext({ plan, movement })
          setDetail(null)
        }}
        onDeleteMoveRequest={(plan, movement) => {
          setDeleteMoveContext({ plan, movement })
          setDetail(null)
        }}
      />

      <DeletePlanDialog
        plan={deletePlanTarget}
        sameRunRecommendationCount={
          deletePlanTarget?.run
            ? runBundles.find((bundle) => bundle.run.id === deletePlanTarget.run!.id)
                ?.recommendations.length ?? 0
            : 0
        }
        isBusy={Boolean(deletePlanTarget && actionPlanId === deletePlanTarget.id)}
        onOpenChange={(open) => {
          if (!open) setDeletePlanTarget(null)
        }}
        onConfirm={handleConfirmDeletePlan}
      />

      <EditPlanDialog
        plan={editPlanTarget}
        isBusy={Boolean(editPlanTarget && actionPlanId === editPlanTarget.id)}
        onOpenChange={(open) => {
          if (!open) setEditPlanTarget(null)
        }}
        onSave={handleSaveEditPlan}
      />

      <EditMoveRequestDialog
        projects={projects}
        context={editMoveContext}
        isBusy={Boolean(
          editMoveContext && actionPlanId === editMoveContext.plan.id
        )}
        onOpenChange={(open) => {
          if (!open) setEditMoveContext(null)
        }}
        onSave={handleSaveEditMoveRequest}
      />

      <DeleteMoveRequestDialog
        context={deleteMoveContext}
        isBusy={Boolean(
          deleteMoveContext && actionPlanId === deleteMoveContext.plan.id
        )}
        onOpenChange={(open) => {
          if (!open) setDeleteMoveContext(null)
        }}
        onConfirm={handleConfirmDeleteMoveRequest}
      />
      <ForceOverrideDialog
        plan={overridePlan}
        reason={overrideReason}
        error={overrideError}
        isBusy={Boolean(overridePlan && actionPlanId === overridePlan.id)}
        onReasonChange={(reason) => {
          setOverrideReason(reason)
          setOverrideError(null)
        }}
        onOpenChange={(open) => {
          if (!open) setOverridePlan(null)
        }}
        onConfirm={handleForceApproveAndExecute}
      />
    </div>
  )
}

function LifecycleTabs({
  activeTab,
  isLoading,
  plans,
  onTabChange,
}: {
  activeTab: MatchingLifecycleState
  isLoading: boolean
  plans: MovePlan[]
  onTabChange: (tab: MatchingLifecycleState) => void
}) {
  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto">
        {lifecycleTabs.map((tab) => (
          <Skeleton key={tab.value} className="h-9 w-36 shrink-0 rounded-3xl" />
        ))}
      </div>
    )
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as MatchingLifecycleState)}
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
    <Card className="h-full min-h-0 shadow-none" size="sm">
      <CardHeader>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-4 w-64 max-w-full rounded-full" />
          </div>
        ) : (
          <>
            <CardTitle>Move plans</CardTitle>
            <CardDescription>Select a plan to review coverage and impact.</CardDescription>
          </>
        )}
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-4">
        <ScrollArea className="h-full min-h-0">
          {isLoading ? (
            <div className="flex w-full flex-col gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-3xl" />
              ))}
            </div>
          ) : plans.length > 0 ? (
            <div className="flex w-full flex-col gap-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className={cn(
                    "w-full rounded-3xl border p-3 text-left transition hover:bg-muted/60",
                    getPlanSurfaceClass(plan.lifecycle),
                    selectedPlanId === plan.id && "border-foreground"
                  )}
                  onClick={() => onSelectPlan(plan.id)}
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                    <ProjectLogo project={plan.targetProject} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{plan.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {plan.targetProject.project_name}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {plan.movements.length} moves
                      </p>
                    </div>
                    <div className="flex min-h-16 shrink-0 flex-col items-end justify-between gap-2">
                      <LifecycleBadge state={plan.lifecycle} />
                      <ImpactBadge impact={plan.highestImpact} />
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

function findCreatedDraftPlan({
  plans,
  runId,
  candidatePlanId,
}: {
  plans: MovePlan[]
  runId: number
  candidatePlanId: string | null
}) {
  if (candidatePlanId) {
    const exactPlan = plans.find(
      (plan) => plan.id === `run-${runId}-${candidatePlanId}`
    )
    if (exactPlan) {
      return exactPlan
    }
  }

  return (
    plans.find(
      (plan) => plan.lifecycle === "draft" && plan.run?.id === runId
    ) ?? null
  )
}

function SelectedPlanWorkspace({
  plan,
  isBusy,
  onOpenDetail,
  onRegenerate,
  onEditConstraints,
  onEditPlan,
  onDeletePlan,
  onEditMoveRequest,
  onDeleteMoveRequest,
  onStartRequest,
  onCancelRequest,
  onForceExecute,
  onRequestStatus,
  onOpenProject,
}: {
  plan: MovePlan
  isBusy: boolean
  onOpenDetail: (detail: DetailSelection) => void
  onRegenerate: (plan: MovePlan) => void
  onEditConstraints: (plan: MovePlan) => void
  onEditPlan: (plan: MovePlan) => void
  onDeletePlan: (plan: MovePlan) => void
  onEditMoveRequest: (plan: MovePlan, movement: ProposedMovement) => void
  onDeleteMoveRequest: (plan: MovePlan, movement: ProposedMovement) => void
  onStartRequest: (plan: MovePlan) => void
  onCancelRequest: (plan: MovePlan) => void
  onForceExecute: (plan: MovePlan) => void
  onRequestStatus: (
    requestId: number,
    status: MoveRequestStatus,
    plan: MovePlan
  ) => void
  onOpenProject: () => void
}) {
  return (
    <div className="min-w-0 rounded-4xl border bg-card">
      <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <ProjectLogo project={plan.targetProject} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold">{plan.title}</h1>
              <LifecycleBadge state={plan.lifecycle} />
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
          onEditPlan={onEditPlan}
          onDeletePlan={onDeletePlan}
          onStartRequest={onStartRequest}
          onCancelRequest={onCancelRequest}
          onForceExecute={onForceExecute}
          onOpenProject={onOpenProject}
        />
      </div>

      <div className="flex flex-col gap-4 p-4">
        <SafetyNotice state={plan.lifecycle} />
        <SummaryStrip plan={plan} />
        <ResponseStatusSummary plan={plan} />

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <RequirementCoverageSection plan={plan} onOpenDetail={onOpenDetail} />
          <ProposedMovementsSection
            plan={plan}
            onOpenDetail={onOpenDetail}
            onRegenerate={onRegenerate}
            onRequestStatus={onRequestStatus}
            onEditMoveRequest={onEditMoveRequest}
            onDeleteMoveRequest={onDeleteMoveRequest}
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
  onEditPlan,
  onDeletePlan,
  onStartRequest,
  onCancelRequest,
  onForceExecute,
  onOpenProject,
}: {
  plan: MovePlan
  isBusy: boolean
  onRegenerate: (plan: MovePlan) => void
  onEditConstraints: (plan: MovePlan) => void
  onEditPlan: (plan: MovePlan) => void
  onDeletePlan: (plan: MovePlan) => void
  onStartRequest: (plan: MovePlan) => void
  onCancelRequest: (plan: MovePlan) => void
  onForceExecute: (plan: MovePlan) => void
  onOpenProject: () => void
}) {
  const editPlanButton = plan.run ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isBusy}
      onClick={() => onEditPlan(plan)}
    >
      <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} data-icon="inline-start" />
      Edit plan
    </Button>
  ) : null

  const deletePlanButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="text-destructive hover:text-destructive"
      disabled={isBusy}
      onClick={() => onDeletePlan(plan)}
    >
      Delete plan
    </Button>
  )

  if (plan.lifecycle === "draft") {
    return (
      <div className="flex flex-wrap gap-2">
        {editPlanButton}
        {deletePlanButton}
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
          Send employee requests
        </Button>
      </div>
    )
  }

  if (plan.lifecycle === "active") {
    return (
      <div className="flex flex-wrap gap-2">
        {editPlanButton}
        {deletePlanButton}
        <Button type="button" variant="outline" size="sm" disabled>
          Remind employees
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
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isBusy || plan.requests.length === 0}
          onClick={() => onForceExecute(plan)}
        >
          Force approve and start transition
        </Button>
      </div>
    )
  }

  if (plan.lifecycle === "ready") {
    return (
      <div className="flex flex-wrap gap-2">
        {editPlanButton}
        {deletePlanButton}
        <Button type="button" variant="outline" size="sm" disabled>
          Transition instructions generated
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {editPlanButton}
      {deletePlanButton}
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
  const copy: Record<MatchingLifecycleState, { title: string; description: string }> = {
    draft: {
      title: "Draft plan",
      description:
        "Nothing has been sent to employees yet. Review coverage and impact before sending requests.",
    },
    active: {
      title: "Waiting for approvals",
      description:
        "Requests have been sent. The plan stays active until CTO and employee approvals are both recorded.",
    },
    ready: {
      title: "Transition in progress",
      description:
        "Both approvals are recorded. Employees can now complete onboarding and offboarding instructions.",
    },
    completed: {
      title: "Transition completed",
      description:
        "Assignments have been applied. Requirements should be reflected in current staffing records.",
    },
  }

  return (
    <Alert>
      <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
      <AlertTitle>{copy[state].title}</AlertTitle>
      <AlertDescription>{copy[state].description}</AlertDescription>
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

function ResponseStatusSummary({ plan }: { plan: MovePlan }) {
  if (plan.requests.length === 0) {
    return null
  }

  const counts = getRequestStatusCounts(plan.requests)
  const items = [
    { label: "Partially approved", value: counts.accepted, status: "accepted" as const },
    { label: "Pending", value: counts.pending, status: "pending" as const },
    {
      label: "Needs clarification",
      value: counts.clarification_requested,
      status: "clarification_requested" as const,
    },
    {
      label: "Transition started",
      value: counts.transition_started,
      status: "transition_started" as const,
    },
    { label: "Completed", value: counts.completed, status: "completed" as const },
    { label: "Rejected", value: counts.rejected, status: "rejected" as const },
  ].filter((item) => item.value > 0)

  return (
    <div className="flex flex-col gap-3 rounded-3xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">Employee response status</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {plan.lifecycle === "active"
            ? "Waiting for CTO and employee approvals before transition instructions are generated."
            : plan.lifecycle === "ready"
              ? "Transition instructions are active for the requested employees."
              : "Responses are retained for the transition audit trail."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge
            key={item.status}
            variant="outline"
            className={getRequestStatusAccentClass(item.status)}
          >
            {item.value} {item.label}
          </Badge>
        ))}
      </div>
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
  onEditMoveRequest,
  onDeleteMoveRequest,
}: {
  plan: MovePlan
  onOpenDetail: (detail: DetailSelection) => void
  onRegenerate: (plan: MovePlan) => void
  onRequestStatus: (
    requestId: number,
    status: MoveRequestStatus,
    plan: MovePlan
  ) => void
  onEditMoveRequest: (plan: MovePlan, movement: ProposedMovement) => void
  onDeleteMoveRequest: (plan: MovePlan, movement: ProposedMovement) => void
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
                    {movement.employee ? (
                      <AvatarImage src={getEmployeeAvatarSrc(movement.employee)} alt="" />
                    ) : null}
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
                        CTO approve
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
                  {movement.request && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={(event) => {
                          event.stopPropagation()
                          onEditMoveRequest(plan, movement)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="text-destructive"
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeleteMoveRequest(plan, movement)
                        }}
                      >
                        Delete
                      </Button>
                    </>
                  )}
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

function DetailSheet({
  detail,
  isBusy,
  onOpenChange,
  onRegenerate,
  onStartRequest,
  onRequestStatus,
  onForceExecute,
  onEditMoveRequest,
  onDeleteMoveRequest,
}: {
  detail: DetailSelection
  isBusy: boolean
  onOpenChange: (open: boolean) => void
  onRegenerate: (plan: MovePlan) => void
  onStartRequest: (plan: MovePlan) => void
  onRequestStatus: (
    requestId: number,
    status: MoveRequestStatus,
    plan: MovePlan
  ) => void
  onForceExecute: (plan: MovePlan) => void
  onEditMoveRequest: (plan: MovePlan, movement: ProposedMovement) => void
  onDeleteMoveRequest: (plan: MovePlan, movement: ProposedMovement) => void
}) {
  return (
    <Sheet open={Boolean(detail)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{getDetailTitle(detail)}</SheetTitle>
          <SheetDescription>
            What this item is, why it matters, current status, and next action.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 overflow-y-auto px-6 pb-6">
          {detail && (
            <DetailContent
              detail={detail}
              isBusy={isBusy}
              onRegenerate={onRegenerate}
              onStartRequest={onStartRequest}
              onRequestStatus={onRequestStatus}
              onForceExecute={onForceExecute}
              onEditMoveRequest={onEditMoveRequest}
              onDeleteMoveRequest={onDeleteMoveRequest}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DetailContent({
  detail,
  isBusy,
  onRegenerate,
  onStartRequest,
  onRequestStatus,
  onForceExecute,
  onEditMoveRequest,
  onDeleteMoveRequest,
}: {
  detail: NonNullable<DetailSelection>
  isBusy: boolean
  onRegenerate: (plan: MovePlan) => void
  onStartRequest: (plan: MovePlan) => void
  onRequestStatus: (
    requestId: number,
    status: MoveRequestStatus,
    plan: MovePlan
  ) => void
  onForceExecute: (plan: MovePlan) => void
  onEditMoveRequest: (plan: MovePlan, movement: ProposedMovement) => void
  onDeleteMoveRequest: (plan: MovePlan, movement: ProposedMovement) => void
}) {
  if (detail.kind === "requirement") {
    const requirement = detail.plan.targetProject.required_skills[detail.row.skill]
    const relatedMovements = detail.plan.movements.filter((movement) =>
      movement.requirementsCovered.some((requirementLabel) =>
        requirementLabel.startsWith(skillLabels[detail.row.skill])
      )
    )
    const uncovered = Math.max(0, detail.row.requiredSlots - detail.row.afterCovered)
    const coveragePercent = getRatioPercent(
      detail.row.afterCovered,
      detail.row.requiredSlots
    )
    return (
      <>
        <DetailHero
          eyebrow="Requirement coverage"
          title={`${skillLabels[detail.row.skill]} coverage`}
          description={`${detail.plan.targetProject.project_name} needs ${
            formatRequirement(requirement) || "no dedicated coverage"
          }.`}
          badge={<CoverageBadge status={detail.row.status} />}
        />
        <DetailActions>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={() => onRegenerate(detail.plan)}
          >
            Regenerate plan
          </Button>
          {detail.plan.lifecycle === "draft" && (
            <Button
              type="button"
              size="sm"
              disabled={isBusy || !detail.plan.run || !detail.plan.recommendation}
              onClick={() => onStartRequest(detail.plan)}
            >
              Send employee requests
            </Button>
          )}
        </DetailActions>
        <DetailMetricGrid
          items={[
            { label: "Required", value: String(detail.row.requiredSlots) },
            { label: "Current", value: String(detail.row.currentCovered) },
            { label: "After plan", value: String(detail.row.afterCovered) },
            { label: "Gap", value: String(uncovered) },
          ]}
        />
        <DetailProgressCard
          label="After-plan coverage"
          value={coveragePercent}
          helper={`${detail.row.afterCovered} of ${detail.row.requiredSlots} required slots covered`}
          tone={detail.row.status === "missing" ? "red" : detail.row.status === "partially_covered" ? "amber" : "green"}
        />
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
          {uncovered > 0
            ? "Regenerate or find a replacement before sending requests."
            : "Coverage looks sufficient. Review employee impact before sending requests."}
        </DetailBlock>
        <TokenList
          label="Covering employees"
          items={detail.row.coveringEmployees.map((employee) => employee.name)}
        />
        <TokenList
          label="Related proposed moves"
          items={relatedMovements.map(
            (movement) => movement.employee?.name ?? "Unknown employee"
          )}
        />
      </>
    )
  }

  if (detail.kind === "movement") {
    const sourceRisk =
      detail.movement.sourceProject &&
      detail.plan.affectedCompanies.find(
        (company) => company.project?.id === detail.movement.sourceProject?.id
      )
    return (
      <>
        <DetailHero
          eyebrow="Proposed movement"
          title={detail.movement.employee?.name ?? "Unknown employee"}
          description={`${detail.movement.sourceProject?.project_name ?? "Bench"} to ${detail.movement.targetProject.project_name}`}
          badge={<RequestStatusBadge status={detail.movement.requestStatus} />}
        />
        <DetailActions>
          {detail.plan.lifecycle === "draft" && (
            <Button
              type="button"
              size="sm"
              disabled={isBusy || !detail.plan.run || !detail.plan.recommendation}
              onClick={() => onStartRequest(detail.plan)}
            >
              Send employee requests
            </Button>
          )}
          {detail.movement.request && detail.plan.lifecycle === "active" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() =>
                  onRequestStatus(detail.movement.request!.id, "accepted", detail.plan)
                }
              >
                CTO approve
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() =>
                  onRequestStatus(
                    detail.movement.request!.id,
                    "clarification_requested",
                    detail.plan
                  )
                }
              >
                Request clarification
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isBusy}
                onClick={() => onForceExecute(detail.plan)}
              >
                Force approve and start transition
              </Button>
            </>
          )}
          {detail.plan.lifecycle === "ready" && (
            <Button type="button" size="sm" disabled>
              Transition instructions active
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={() => onRegenerate(detail.plan)}
          >
            Find replacement
          </Button>
          {detail.movement.request && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => onEditMoveRequest(detail.plan, detail.movement)}
              >
                Edit move request
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isBusy}
                onClick={() => onDeleteMoveRequest(detail.plan, detail.movement)}
              >
                Delete move request
              </Button>
            </>
          )}
        </DetailActions>
        <DetailMetricGrid
          items={[
            { label: "Status", value: formatRequestStatus(detail.movement.requestStatus) },
            { label: "Impact", value: formatImpact(detail.movement.currentProjectImpact) },
            { label: "From", value: detail.movement.sourceProject?.project_name ?? "Bench" },
            { label: "To", value: detail.movement.targetProject.project_name },
          ]}
        />
        <DetailProgressCard
          label="Source company capacity after move"
          value={
            sourceRisk
              ? getRatioPercent(sourceRisk.afterHeadcount, sourceRisk.requiredHeadcount)
              : 100
          }
          helper={
            sourceRisk
              ? `${sourceRisk.afterHeadcount} of ${sourceRisk.requiredHeadcount} required people remain`
              : "No source-company capacity constraint affected"
          }
          tone={
            detail.movement.currentProjectImpact === "high"
              ? "red"
              : detail.movement.currentProjectImpact === "medium"
                ? "amber"
                : "green"
          }
        />
        <DetailBlock label="What is this?">
          {detail.movement.employee?.name ?? "Unknown employee"} moving from{" "}
          {detail.movement.sourceProject?.project_name ?? "Bench"} to{" "}
          {detail.movement.targetProject.project_name}.
        </DetailBlock>
        <DetailBlock label="Why it matters?">{detail.movement.reason}</DetailBlock>
        <DetailBlock label="Current status">
          {formatRequestStatus(detail.movement.requestStatus)}
        </DetailBlock>
        <DetailBlock label="Source company risk">
          {sourceRisk
            ? `${sourceRisk.afterHeadcount} / ${sourceRisk.requiredHeadcount} people after plan, ${formatImpact(sourceRisk.risk)} risk.`
            : "No source-company staffing risk detected for this movement."}
        </DetailBlock>
        <DetailBlock label="Next action">
          {detail.plan.lifecycle === "draft"
            ? "Start the move request when the plan has been reviewed."
            : detail.plan.lifecycle === "active"
              ? "Track the employee response, replace this move, or use CTO override if necessary."
              : "Transition instructions are active for this employee."}
        </DetailBlock>
        <TokenList label="Requirements covered" items={detail.movement.requirementsCovered} />
      </>
    )
  }

  if (detail.kind === "company") {
    const causedByMoves = detail.plan.movements.filter(
      (movement) => movement.sourceProject?.id === detail.company.project?.id
    )
    return (
      <>
        <DetailHero
          eyebrow="Source company impact"
          title={detail.company.project?.project_name ?? "Bench"}
          description={`${detail.company.lostEmployees.length} employee${
            detail.company.lostEmployees.length === 1 ? "" : "s"
          } proposed to move out.`}
          badge={<ImpactBadge impact={detail.company.risk} />}
        />
        <DetailActions>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={() => onRegenerate(detail.plan)}
          >
            Find replacement
          </Button>
          {detail.plan.lifecycle === "active" && detail.company.risk === "high" && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isBusy}
              onClick={() => onForceExecute(detail.plan)}
            >
              Override with risk accepted
            </Button>
          )}
        </DetailActions>
        <DetailMetricGrid
          items={[
            { label: "Before", value: String(detail.company.beforeHeadcount) },
            { label: "After", value: String(detail.company.afterHeadcount) },
            { label: "Required", value: String(detail.company.requiredHeadcount) },
            { label: "Risk", value: formatImpact(detail.company.risk) },
          ]}
        />
        <DetailProgressCard
          label="Headcount after plan"
          value={getRatioPercent(
            detail.company.afterHeadcount,
            detail.company.requiredHeadcount
          )}
          helper={`${detail.company.afterHeadcount} of ${detail.company.requiredHeadcount} required people remain`}
          tone={
            detail.company.risk === "high"
              ? "red"
              : detail.company.risk === "medium"
                ? "amber"
                : "green"
          }
        />
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
        <TokenList
          label="Caused by moves"
          items={causedByMoves.map(
            (movement) =>
              `${movement.employee?.name ?? "Unknown employee"} to ${movement.targetProject.project_name}`
          )}
        />
      </>
    )
  }

  return (
    <>
      <DetailHero
        eyebrow="Employee impact"
        title={detail.impact.employee?.name ?? "Unknown employee"}
        description={`${detail.impact.movement.sourceProject?.project_name ?? "Bench"} to ${detail.impact.movement.targetProject.project_name}`}
        badge={<RequestStatusBadge status={detail.impact.status} />}
      />
      <DetailActions>
        {detail.impact.movement.request && detail.plan.lifecycle === "active" && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() =>
                onRequestStatus(
                  detail.impact.movement.request!.id,
                  "accepted",
                  detail.plan
                )
              }
            >
              CTO approve
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isBusy}
              onClick={() => onForceExecute(detail.plan)}
            >
              Force approve and start transition
            </Button>
          </>
        )}
        {detail.plan.lifecycle === "ready" && (
          <Button type="button" size="sm" disabled>
            Transition instructions active
          </Button>
        )}
        {detail.impact.movement.request && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => onEditMoveRequest(detail.plan, detail.impact.movement)}
            >
              Edit move request
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isBusy}
              onClick={() => onDeleteMoveRequest(detail.plan, detail.impact.movement)}
            >
              Delete move request
            </Button>
          </>
        )}
      </DetailActions>
      <DetailMetricGrid
        items={[
          { label: "Status", value: formatRequestStatus(detail.impact.status) },
          { label: "Effort", value: detail.impact.transitionEffort },
          {
            label: "From",
            value: detail.impact.movement.sourceProject?.project_name ?? "Bench",
          },
          { label: "To", value: detail.impact.movement.targetProject.project_name },
        ]}
      />
      <DetailProgressCard
        label="Transition readiness"
        value={
          detail.impact.status === "accepted"
            ? 100
            : detail.impact.status === "pending"
              ? 45
              : detail.impact.status === "clarification_requested"
                ? 30
                : 15
        }
        helper={detail.impact.handoffNeeds}
        tone={
          detail.impact.status === "accepted"
            ? "green"
            : detail.impact.status === "rejected"
              ? "red"
              : "amber"
        }
      />
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
      <TokenList
        label="Requirements covered"
        items={detail.impact.movement.requirementsCovered}
      />
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
    <section className="rounded-3xl border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm">{children}</p>
    </section>
  )
}

function DetailHero({
  eyebrow,
  title,
  description,
  badge,
}: {
  eyebrow: string
  title: string
  description: string
  badge: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-3xl border bg-muted/35">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </p>
          <h3 className="mt-1 truncate text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="shrink-0">{badge}</div>
      </div>
      <div className="h-1 bg-gradient-to-r from-green-500/70 via-amber-500/60 to-red-500/70" />
    </section>
  )
}

function DetailMetricGrid({
  items,
}: {
  items: Array<{ label: string; value: string }>
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border bg-background p-3 shadow-xs"
        >
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-1 truncate font-medium">{item.value}</p>
        </div>
      ))}
    </div>
  )
}

function DetailProgressCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string
  value: number
  helper: string
  tone: "green" | "amber" | "red"
}) {
  return (
    <section className="rounded-3xl border bg-background p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <Badge variant="outline" className={getToneBadgeClass(tone)}>
          {Math.round(value)}%
        </Badge>
      </div>
      <Progress
        value={Math.min(100, Math.max(0, value))}
        className={cn(
          "h-2 [&_[data-slot=progress-indicator]]:transition-all [&_[data-slot=progress-indicator]]:duration-700",
          tone === "green" && "[&_[data-slot=progress-indicator]]:bg-green-600",
          tone === "amber" && "[&_[data-slot=progress-indicator]]:bg-amber-500",
          tone === "red" && "[&_[data-slot=progress-indicator]]:bg-red-600"
        )}
      />
    </section>
  )
}

function DetailActions({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border bg-muted/25 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Actions
      </p>
      <div className="flex flex-wrap gap-2">
      {children}
      </div>
    </div>
  )
}

function TokenList({ label, items }: { label: string; items: string[] }) {
  return (
    <section className="rounded-3xl border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
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
    </section>
  )
}

const BENCH_SELECT_VALUE = "__bench__"

function DeletePlanDialog({
  plan,
  sameRunRecommendationCount,
  isBusy,
  onOpenChange,
  onConfirm,
}: {
  plan: MovePlan | null
  sameRunRecommendationCount: number
  isBusy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const multiPlanWarning =
    plan?.run &&
    sameRunRecommendationCount > 1

  return (
    <Dialog open={Boolean(plan)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete this plan?</DialogTitle>
          <DialogDescription>
            {plan?.lifecycle === "completed"
              ? "This removes stored matching data and related move requests. It does not revert company assignments that were already applied."
              : "This permanently deletes the move requests for this plan and removes the matching run (draft recommendations and audit events)."}
          </DialogDescription>
        </DialogHeader>
        {multiPlanWarning && (
          <Alert>
            <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
            <AlertTitle>Multiple recommendations on one run</AlertTitle>
            <AlertDescription>
              Deleting will remove the entire matching run and all{" "}
              {sameRunRecommendationCount} recommendation plan
              {sameRunRecommendationCount === 1 ? "" : "s"} tied to it.
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={isBusy} onClick={onConfirm}>
            Delete plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditPlanFormBody({
  plan,
  isBusy,
  onCancel,
  onSave,
}: {
  plan: MovePlan
  isBusy: boolean
  onCancel: () => void
  onSave: (planName: string, goal: string) => void | Promise<void>
}) {
  const run = plan.run!
  const meta = getCreateFlowMetadata(run)
  const [planName, setPlanName] = useState(
    () => (meta?.planName ?? plan.title).trim() || plan.title
  )
  const [goal, setGoal] = useState(
    () => (meta?.goal ?? plan.summary).trim() || plan.summary
  )

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="edit-plan-name">
            Plan name
          </label>
          <Input
            id="edit-plan-name"
            value={planName}
            onChange={(event) => setPlanName(event.target.value)}
            maxLength={200}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="edit-plan-goal">
            Goal
          </label>
          <Textarea
            id="edit-plan-goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            className="min-h-24"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={isBusy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={isBusy || !planName.trim() || !goal.trim()}
          onClick={() => onSave(planName, goal)}
        >
          Save
        </Button>
      </DialogFooter>
    </>
  )
}

function EditPlanDialog({
  plan,
  isBusy,
  onOpenChange,
  onSave,
}: {
  plan: MovePlan | null
  isBusy: boolean
  onOpenChange: (open: boolean) => void
  onSave: (planName: string, goal: string) => void | Promise<void>
}) {
  return (
    <Dialog open={Boolean(plan)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit plan</DialogTitle>
          <DialogDescription>
            Update the display name and goal stored on this matching run.
          </DialogDescription>
        </DialogHeader>
        {plan?.run && (
          <EditPlanFormBody
            key={plan.run!.id}
            plan={plan}
            isBusy={isBusy}
            onCancel={() => onOpenChange(false)}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function EditMoveRequestFormBody({
  projects,
  request,
  isBusy,
  onCancel,
  onSave,
}: {
  projects: Project[]
  request: MoveRequest
  isBusy: boolean
  onCancel: () => void
  onSave: (payload: MoveRequestUpdateInput) => void | Promise<void>
}) {
  const [reason, setReason] = useState(() => request.reason)
  const [expectedRole, setExpectedRole] = useState(() => request.expected_role)
  const [impact, setImpact] = useState<ImpactLevel>(() => request.current_project_impact)
  const [fromProjectId, setFromProjectId] = useState(() =>
    request.from_project_id != null
      ? String(request.from_project_id)
      : BENCH_SELECT_VALUE
  )
  const [toProjectId, setToProjectId] = useState(() => String(request.to_project_id))

  return (
    <>
      <div className="flex max-h-[min(28rem,70vh)] flex-col gap-3 overflow-y-auto pr-1">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Employee</span>
          <p className="text-sm text-muted-foreground">{request.employee_name}</p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">From company</span>
          <Select value={fromProjectId} onValueChange={setFromProjectId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Source company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={BENCH_SELECT_VALUE}>Bench (unassigned)</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={String(project.id)}>
                  {project.project_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">To company</span>
          <Select value={toProjectId} onValueChange={setToProjectId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Target company" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={String(project.id)}>
                  {project.project_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="edit-mr-role">
            Expected role
          </label>
          <Input
            id="edit-mr-role"
            value={expectedRole}
            onChange={(event) => setExpectedRole(event.target.value)}
            maxLength={255}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Current company impact</span>
          <Select
            value={impact}
            onValueChange={(value) => setImpact(value as ImpactLevel)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="edit-mr-reason">
            Reason
          </label>
          <Textarea
            id="edit-mr-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-24"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={isBusy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={
            isBusy || !reason.trim() || !expectedRole.trim() || !toProjectId
          }
          onClick={() =>
            onSave({
              reason: reason.trim(),
              expected_role: expectedRole.trim(),
              current_project_impact: impact,
              from_project_id:
                fromProjectId === BENCH_SELECT_VALUE ? null : Number(fromProjectId),
              to_project_id: Number(toProjectId),
            })
          }
        >
          Save changes
        </Button>
      </DialogFooter>
    </>
  )
}

function EditMoveRequestDialog({
  projects,
  context,
  isBusy,
  onOpenChange,
  onSave,
}: {
  projects: Project[]
  context: { plan: MovePlan; movement: ProposedMovement } | null
  isBusy: boolean
  onOpenChange: (open: boolean) => void
  onSave: (payload: MoveRequestUpdateInput) => void | Promise<void>
}) {
  const request = context?.movement.request

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit move request</DialogTitle>
          <DialogDescription>
            Changes are saved to the move request record only; company assignments are
            not updated automatically.
          </DialogDescription>
        </DialogHeader>
        {request && (
          <EditMoveRequestFormBody
            key={request.id}
            projects={projects}
            request={request}
            isBusy={isBusy}
            onCancel={() => onOpenChange(false)}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DeleteMoveRequestDialog({
  context,
  isBusy,
  onOpenChange,
  onConfirm,
}: {
  context: { plan: MovePlan; movement: ProposedMovement } | null
  isBusy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const name = context?.movement.employee?.name ?? "This employee"

  return (
    <Dialog open={Boolean(context?.movement.request)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete move request?</DialogTitle>
          <DialogDescription>
            Remove the request for {name}. The proposed move may still appear on the plan
            until you regenerate or adjust staffing elsewhere.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={isBusy} onClick={onConfirm}>
            Delete request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ForceOverrideDialog({
  plan,
  reason,
  error,
  isBusy,
  onReasonChange,
  onOpenChange,
  onConfirm,
}: {
  plan: MovePlan | null
  reason: string
  error: string | null
  isBusy: boolean
  onReasonChange: (reason: string) => void
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const counts = plan ? getRequestStatusCounts(plan.requests) : null
  const forcedRequests =
    plan?.requests.filter(
      (request) =>
        request.status !== "transition_started" && request.status !== "completed"
    ) ?? []
  const riskyCompanies =
    plan?.affectedCompanies.filter((company) => company.risk !== "low") ?? []

  return (
    <Dialog open={Boolean(plan)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Force approve and start transition</DialogTitle>
          <DialogDescription>
            This bypasses employee confirmation, records both approvals, starts
            transition instruction generation, and applies company assignments.
          </DialogDescription>
        </DialogHeader>

        {plan && counts && (
          <div className="flex flex-col gap-4">
            <Alert variant="destructive">
              <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
              <AlertTitle>CTO override required</AlertTitle>
              <AlertDescription>
                Use this only when the transition must happen before every employee
                has confirmed. The reason will be stored with the matching run.
              </AlertDescription>
            </Alert>

            <div className="grid gap-2 sm:grid-cols-6">
              {([
                ["Partial", counts.accepted],
                ["Pending", counts.pending],
                ["Clarification", counts.clarification_requested],
                ["Transition started", counts.transition_started],
                ["Completed", counts.completed],
                ["Rejected", counts.rejected],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-2xl border bg-muted/35 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>

            <TokenList
              label="Employees being force-approved"
              items={forcedRequests.map((request) => request.employee_name)}
            />
            <TokenList
              label="Source-company risks"
              items={
                riskyCompanies.length > 0
                  ? riskyCompanies.map(
                      (company) =>
                        `${company.project?.project_name ?? "Bench"}: ${formatImpact(
                          company.risk
                        )} risk (${company.afterHeadcount}/${company.requiredHeadcount})`
                    )
                  : ["No medium or high source-company risk detected"]
              }
            />

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="cto-override-reason">
                Override reason
              </label>
              <Textarea
                id="cto-override-reason"
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder="Explain why this move must start before employee confirmation."
                className="min-h-28"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isBusy}
            onClick={onConfirm}
          >
            {isBusy ? "Starting..." : "Force approve and start transition"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EmptyWorkspace({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="shadow-none">
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
    <div className="flex min-w-0 flex-col gap-4 rounded-4xl border bg-card p-4">
      <div className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-72 max-w-full rounded-full" />
            <Skeleton className="h-4 w-[28rem] max-w-full rounded-full" />
            <Skeleton className="h-4 w-80 max-w-full rounded-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-3xl" />
          <Skeleton className="h-9 w-32 rounded-3xl" />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-3xl" />
        ))}
      </div>

      <div className="grid min-h-0 gap-4 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <SectionSkeleton rows={6} />
        <SectionSkeleton rows={5} />
        <SectionSkeleton rows={4} />
        <SectionSkeleton rows={4} />
      </div>
    </div>
  )
}

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="rounded-3xl border p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-4 w-56 rounded-full" />
        </div>
        <Skeleton className="h-8 w-20 rounded-3xl" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-10 rounded-2xl" />
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
    <Badge variant="outline" className={getCoverageAccentClass(status)}>
      {labels[status]}
    </Badge>
  )
}

function ImpactBadge({ impact }: { impact: "low" | "medium" | "high" }) {
  return (
    <Badge variant="outline" className={getImpactAccentClass(impact)}>
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
    <Badge variant="outline" className={getRequestStatusAccentClass(status)}>
      {formatRequestStatus(status)}
    </Badge>
  )
}

function LifecycleBadge({ state }: { state: MatchingLifecycleState }) {
  return (
    <Badge variant="outline" className={getLifecycleAccentClass(state)}>
      {getLifecycleStatusLabel(state)}
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

function getPlanSurfaceClass(state: MatchingLifecycleState) {
  if (state === "draft") {
    return "bg-muted/45"
  }

  return "bg-card"
}

function getLifecycleStatusLabel(state: MatchingLifecycleState) {
  const labels: Record<MatchingLifecycleState, string> = {
    draft: "Draft",
    active: "Waiting",
    ready: "Transitioning",
    completed: "Completed",
  }

  return labels[state]
}

function getLifecycleAccentClass(state: MatchingLifecycleState) {
  if (state === "draft") {
    return "border-border bg-muted text-foreground"
  }

  if (state === "active") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  }

  if (state === "ready") {
    return "border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300"
  }

  return "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-300"
}

function getRequestStatusCounts(requests: MoveRequest[]) {
  return requests.reduce(
    (counts, request) => {
      counts[request.status] += 1
      return counts
    },
    {
      accepted: 0,
      pending: 0,
      clarification_requested: 0,
      transition_started: 0,
      completed: 0,
      rejected: 0,
    } satisfies Record<MoveRequestStatus, number>
  )
}

function getRatioPercent(value: number, total: number) {
  if (total <= 0) return 100
  return Math.round((value / total) * 100)
}

function getToneBadgeClass(tone: "green" | "amber" | "red") {
  if (tone === "green") {
    return "border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300"
  }

  if (tone === "amber") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  }

  return "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300"
}

function getCoverageAccentClass(status: RequirementCoverageRow["status"]) {
  if (status === "covered") {
    return "border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300"
  }

  if (status === "partially_covered") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  }

  if (status === "missing") {
    return "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300"
  }

  return "border-border bg-muted/60 text-muted-foreground"
}

function getImpactAccentClass(impact: "low" | "medium" | "high") {
  if (impact === "low") {
    return "border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300"
  }

  if (impact === "medium") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  }

  return "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300"
}

function getRequestStatusAccentClass(status: MoveRequestStatus | "not_sent") {
  if (status === "accepted") {
    return "border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300"
  }

  if (status === "completed") {
    return "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-300"
  }

  if (status === "rejected") {
    return "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300"
  }

  if (status === "clarification_requested") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  }

  if (status === "transition_started") {
    return "border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
  }

  if (status === "pending") {
    return "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
  }

  return "border-border bg-muted/60 text-muted-foreground"
}
