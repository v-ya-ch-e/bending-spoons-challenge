"use client"

import { useMemo, useState, type ReactNode } from "react"
import {
  InformationCircleIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { runProjectMatching, type MatchingRunResponse } from "@/lib/backend-api"
import {
  createMatchingPolicy,
  getMatchingRun,
  updateMatchingRun,
  type Employee,
  type MatchingPolicy,
  type Project,
  type ProjectSkillRequirement,
} from "@/lib/db-api"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  buildPreviewMovePlan,
  formatImpact,
  formatRequirement,
  formatRequestStatus,
  getRequirementTotal,
  skillKeys,
  skillLabels,
  type MatchingCreateFlowMetadata,
  type MovePlan,
} from "@/components/matching/matching-model"

type CreateMatchingDialogProps = {
  open: boolean
  employees: Employee[]
  projects: Project[]
  policies: MatchingPolicy[]
  initialTargetProjectId: string
  initialPolicyId: string
  requestedBy: string
  onOpenChange: (open: boolean) => void
  onCreated: (createdPlan: {
    runId: number
    candidatePlanId: string | null
  }) => boolean | Promise<boolean>
}

type StepId = "target" | "constraints" | "generate" | "final"

type FormState = {
  targetProjectId: string
  planName: string
  goal: string
  policyId: string
  avoidBreakingMinimums: boolean
  excludeOpenMoveRequests: boolean
  preferFewerMoves: boolean
  maxMoves: string
}

type GeneratedPlan = {
  response: MatchingRunResponse
  candidatePlanId: string | null
}

type GenerationStage =
  | "idle"
  | "creating_policy"
  | "running_matching"
  | "saving_plan"
  | "ready"
  | "failed"

const steps: Array<{
  id: StepId
  label: string
  description: string
}> = [
  { id: "target", label: "Target", description: "Company and goal." },
  { id: "constraints", label: "Constraints", description: "Matching rules." },
  { id: "generate", label: "Generate", description: "Run matching." },
  { id: "final", label: "Final", description: "Review and confirm." },
]

const CUSTOM_POLICY_VALUE = "__custom__"
const MAX_MATCHING_MOVES = 5
const runningGenerationStages: GenerationStage[] = [
  "creating_policy",
  "running_matching",
  "saving_plan",
]

export function CreateMatchingDialog({
  open,
  employees,
  projects,
  policies,
  initialTargetProjectId,
  initialPolicyId,
  requestedBy,
  onOpenChange,
  onCreated,
}: CreateMatchingDialogProps) {
  const initialProject = projects.find(
    (project) => String(project.id) === initialTargetProjectId
  )
  const initialPolicy = policies.find((policy) => String(policy.id) === initialPolicyId)
  const initialConstraints = getPolicyConstraintState(initialPolicy)
  const [stepIndex, setStepIndex] = useState(0)
  const [formState, setFormState] = useState<FormState>(() => ({
    targetProjectId: initialTargetProjectId,
    planName: initialProject ? `Staff ${initialProject.project_name}` : "",
    goal: initialProject
      ? `Reach minimum staffing requirements for ${initialProject.project_name}.`
      : "",
    policyId: initialPolicyId,
    ...initialConstraints,
  }))
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [generationStage, setGenerationStage] = useState<GenerationStage>("idle")
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null)

  const currentStep = steps[stepIndex]
  const isFirstStep = stepIndex === 0
  const isFinalStep = currentStep.id === "final"
  const targetProject = projects.find(
    (project) => String(project.id) === formState.targetProjectId
  )
  const isCustomPolicy = formState.policyId === CUSTOM_POLICY_VALUE
  const selectedPolicy = isCustomPolicy
    ? undefined
    : policies.find((policy) => String(policy.id) === formState.policyId)
  const generatedSuggestion = generatedPlan?.response.suggestions[0]
  const generatedPreviewPlan = useMemo(() => {
    if (!generatedSuggestion || !targetProject) {
      return null
    }

    return buildPreviewMovePlan({
      employees,
      projects,
      targetProject,
      suggestion: generatedSuggestion,
      title: formState.planName.trim(),
      summary: formState.goal.trim(),
    })
  }, [
    employees,
    formState.goal,
    formState.planName,
    generatedSuggestion,
    projects,
    targetProject,
  ])
  const hasGeneratedDraft = Boolean(generatedPreviewPlan)
  const isGenerating = runningGenerationStages.includes(generationStage)

  const summary = useMemo(() => {
    const proposedMoves = generatedPreviewPlan?.movements.length ?? 0
    const highestImpact = generatedPreviewPlan?.highestImpact ?? "low"
    const coveragePercent = generatedPreviewPlan?.coveragePercent ?? 0

    return { proposedMoves, highestImpact, coveragePercent }
  }, [generatedPreviewPlan])

  function updateFormState(nextState: Partial<FormState>) {
    setFormState((current) => ({ ...current, ...nextState }))
    setValidationError(null)
    setSubmitError(null)
    setGeneratedPlan(null)
    setGenerationStage("idle")
  }

  function handleTargetProjectChange(projectId: string) {
    const nextProject = projects.find((project) => String(project.id) === projectId)
    updateFormState({
      targetProjectId: projectId,
      planName:
        !formState.planName.trim() || targetProject
          ? `Staff ${nextProject?.project_name ?? "target company"}`
          : formState.planName,
      goal:
        !formState.goal.trim() || targetProject
          ? `Reach minimum staffing requirements for ${
              nextProject?.project_name ?? "the target company"
            }.`
          : formState.goal,
    })
  }

  function validateStep(step: StepId) {
    if (step === "target") {
      if (!formState.targetProjectId) return "Select the target company."
      if (!formState.planName.trim()) return "Enter a move plan name."
      if (!formState.goal.trim()) return "Enter the plan goal."
    }

    if (step === "constraints" && !formState.policyId) {
      return "Select a matching policy."
    }

    if (step === "constraints" && formState.preferFewerMoves) {
      const maxMoves = Number(formState.maxMoves)
      if (
        !Number.isInteger(maxMoves) ||
        maxMoves < 1 ||
        maxMoves > MAX_MATCHING_MOVES
      ) {
        return `Set the maximum move count between 1 and ${MAX_MATCHING_MOVES}.`
      }
    }

    return null
  }

  function canNavigateToStep(targetStepIndex: number) {
    if (targetStepIndex <= stepIndex) return true
    if (targetStepIndex === 3) return Boolean(generatedPlan)

    return steps
      .slice(0, targetStepIndex)
      .every((step) => validateStep(step.id) === null)
  }

  function handleStepChange(targetStepIndex: number) {
    if (targetStepIndex === stepIndex || isGenerating) return

    if (!canNavigateToStep(targetStepIndex)) {
      setValidationError(validateStep(currentStep.id))
      return
    }

    setValidationError(null)
    setSubmitError(null)
    setStepIndex(targetStepIndex)
  }

  function handleNext() {
    const nextValidationError = validateStep(currentStep.id)
    if (nextValidationError) {
      setValidationError(nextValidationError)
      return
    }

    setValidationError(null)
    setSubmitError(null)
    setStepIndex((current) => Math.min(current + 1, steps.length - 1))
  }

  function handleBack() {
    setValidationError(null)
    setSubmitError(null)
    setStepIndex((current) => Math.max(current - 1, 0))
  }

  function handlePolicyChange(policyId: string) {
    if (policyId === CUSTOM_POLICY_VALUE) {
      updateFormState({ policyId })
      return
    }

    const nextPolicy = policies.find((policy) => String(policy.id) === policyId)
    updateFormState({
      policyId,
      ...getPolicyConstraintState(nextPolicy),
    })
  }

  function handleConstraintChange(nextState: Partial<FormState>) {
    updateFormState({
      ...nextState,
      policyId: CUSTOM_POLICY_VALUE,
    })
  }

  async function handleGenerate() {
    const targetValidationError = validateStep("target")
    const constraintsValidationError = validateStep("constraints")

    if (targetValidationError || constraintsValidationError || !targetProject) {
      setValidationError(targetValidationError ?? constraintsValidationError)
      setStepIndex(targetValidationError ? 0 : 1)
      return
    }

    setGenerationStage(isCustomPolicy ? "creating_policy" : "running_matching")
    setValidationError(null)
    setSubmitError(null)

    try {
      const runPolicy = isCustomPolicy
        ? await createMatchingPolicy({
            name: getCustomPolicyName(formState.planName),
            description:
              "Plan-specific matching constraints created from the CTO move-plan flow.",
            config: getCustomPolicyConfig(formState, initialPolicy ?? policies[0]),
            is_active: false,
          })
        : selectedPolicy

      setGenerationStage("running_matching")
      const response = await runProjectMatching(targetProject.id, {
        policy_id: runPolicy?.id,
        requested_by: requestedBy,
      })
      const candidatePlanId =
        response.summary.selected_candidate_plan_id ??
        response.suggestions[0]?.candidate_plan_id ??
        null
      const persistedRun = await getMatchingRun(response.run_id)
      setGenerationStage("saving_plan")
      const metadata: MatchingCreateFlowMetadata = {
        planName: formState.planName.trim(),
        goal: formState.goal.trim(),
        targetProjectId: targetProject.id,
        targetProjectName: targetProject.project_name,
        policyId: runPolicy?.id,
        policyName: runPolicy?.name,
        policyPreset: isCustomPolicy ? "Custom" : "Saved preset",
        candidatePool: "All eligible employees",
        moveTiming: "Move requests are created only after the CTO opens a draft plan",
        impactTolerance: runPolicy?.name ?? "Selected matching policy",
        avoidBreakingMinimums: formState.avoidBreakingMinimums,
        excludeOpenMoveRequests: formState.excludeOpenMoveRequests,
        preferLowerTransitionEffort: true,
        preferFewerMoves: formState.preferFewerMoves,
        maxMoves: formState.preferFewerMoves ? Number(formState.maxMoves) : undefined,
        createdAt: new Date().toISOString(),
      }

      await updateMatchingRun(response.run_id, {
        input_snapshot: {
          ...(persistedRun.input_snapshot ?? {}),
          matching_create_flow: metadata,
        },
      })

      setGeneratedPlan({ response, candidatePlanId })
      setGenerationStage("ready")
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to generate move plan."
      )
      setGenerationStage("failed")
    }
  }

  async function handleOpenDraftPlan() {
    if (!generatedPlan) return
    const opened = await onCreated({
      runId: generatedPlan.response.run_id,
      candidatePlanId: generatedPlan.candidatePlanId,
    })

    if (!opened) {
      setSubmitError("The matching run completed, but no draft plan is available to open.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(47rem,calc(100svh-2rem))] flex-col gap-0 overflow-hidden p-0 shadow-none sm:max-w-6xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-lg">Create move plan</DialogTitle>
          <DialogDescription>
            Plan employee movements before sending requests.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 md:grid-cols-[17rem_1fr]">
          <StepNavigation
            currentStepIndex={stepIndex}
            canNavigateToStep={canNavigateToStep}
            onStepChange={handleStepChange}
          />

          <div className="min-h-0 border-t border-border md:border-t-0 md:border-l">
            <div className="h-full overflow-y-auto px-6 py-6">
              <div className="mx-auto flex max-w-3xl flex-col gap-5">
                {validationError && (
                  <Alert variant="destructive">
                    <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
                    <AlertTitle>Check this step</AlertTitle>
                    <AlertDescription>{validationError}</AlertDescription>
                  </Alert>
                )}
                {submitError && (
                  <Alert variant="destructive">
                    <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
                    <AlertTitle>Generation failed</AlertTitle>
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                )}

                {currentStep.id === "target" && (
                  <TargetStep
                    formState={formState}
                    projects={projects}
                    targetProject={targetProject}
                    onChange={updateFormState}
                    onTargetProjectChange={handleTargetProjectChange}
                  />
                )}
                {currentStep.id === "constraints" && (
                  <ConstraintsStep
                    policyId={formState.policyId}
                    policies={policies}
                    formState={formState}
                    isCustomPolicy={isCustomPolicy}
                    onPolicyChange={handlePolicyChange}
                    onConstraintChange={handleConstraintChange}
                  />
                )}
                {currentStep.id === "generate" && (
                  <GenerateStep
                    targetProject={targetProject}
                    policyLabel={
                      isCustomPolicy
                        ? "Custom impact tolerance"
                        : selectedPolicy?.name ?? "Selected matching policy"
                    }
                    isCustomPolicy={isCustomPolicy}
                    stage={generationStage}
                  />
                )}
                {currentStep.id === "final" && generatedPlan && targetProject && (
                  <FinalStep
                    targetProject={targetProject}
                    formState={formState}
                    summary={summary}
                    previewPlan={generatedPreviewPlan}
                    warnings={generatedPlan.response.diagnostics.warnings}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={isGenerating}
            onClick={() => onOpenChange(false)}
          >
            {isFinalStep ? "Close" : "Cancel"}
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isFirstStep || isGenerating}
            >
              Back
            </Button>
            {currentStep.id === "generate" ? (
              <Button
                type="button"
                onClick={
                  generationStage === "ready"
                    ? () => setStepIndex(3)
                    : handleGenerate
                }
                disabled={isGenerating}
              >
                {getGenerateButtonLabel(generationStage, hasGeneratedDraft)}
              </Button>
            ) : isFinalStep ? (
              <Button
                type="button"
                onClick={hasGeneratedDraft ? handleOpenDraftPlan : () => onOpenChange(false)}
              >
                {hasGeneratedDraft ? "Open draft plan" : "Close"}
              </Button>
            ) : (
              <Button type="button" onClick={handleNext}>
                Continue
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StepNavigation({
  currentStepIndex,
  canNavigateToStep,
  onStepChange,
}: {
  currentStepIndex: number
  canNavigateToStep: (stepIndex: number) => boolean
  onStepChange: (stepIndex: number) => void
}) {
  return (
    <nav className="flex gap-2 overflow-x-auto bg-muted/20 p-4 md:flex-col md:p-5">
      {steps.map((step, index) => {
        const isActive = index === currentStepIndex
        const isLocked = !canNavigateToStep(index)
        const isCompleted = index < currentStepIndex && !isLocked

        return (
          <button
            key={step.id}
            type="button"
            disabled={isLocked}
            onClick={() => onStepChange(index)}
            className={cn(
              "flex min-w-52 items-center gap-3 rounded-3xl bg-muted/50 px-3 py-3 text-left transition-colors md:min-w-0",
              isActive && "bg-green-50 ring-1 ring-green-600/20 dark:bg-green-950/20",
              isCompleted && !isActive && "bg-green-50/60 dark:bg-green-950/15",
              isLocked && "cursor-not-allowed opacity-55"
            )}
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-medium",
                isActive && "border-green-600 bg-green-600 text-white",
                isCompleted &&
                  !isActive &&
                  "border-green-600/40 bg-green-600/10 text-green-700 dark:text-green-300"
              )}
            >
              {isCompleted ? (
                <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
              ) : (
                index + 1
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{step.label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {isCompleted ? "Complete" : step.description}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}

function TargetStep({
  formState,
  projects,
  targetProject,
  onChange,
  onTargetProjectChange,
}: {
  formState: FormState
  projects: Project[]
  targetProject?: Project
  onChange: (nextState: Partial<FormState>) => void
  onTargetProjectChange: (projectId: string) => void
}) {
  return (
    <section className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-6 duration-200">
      <StepHeading
        title="1. Target company"
        description="Select the company that needs additional capacity."
      />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="matching-target">
          Target company
        </label>
        <Select value={formState.targetProjectId} onValueChange={onTargetProjectChange}>
          <SelectTrigger id="matching-target">
            <SelectValue placeholder="Select company" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {projects.map((project) => (
                <SelectItem
                  key={project.id}
                  value={String(project.id)}
                  textValue={project.project_name}
                >
                  <ProjectSelectOption project={project} />
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="move-plan-name">
          Move plan name
        </label>
        <Input
          id="move-plan-name"
          value={formState.planName}
          onChange={(event) => onChange({ planName: event.target.value })}
          placeholder="Staff Eventbrite Integration"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="move-plan-goal">
          Goal
        </label>
        <Textarea
          id="move-plan-goal"
          value={formState.goal}
          onChange={(event) => onChange({ goal: event.target.value })}
          placeholder="Reach minimum staffing requirements for the new acquisition integration."
        />
      </div>

      {targetProject && <MinimumRequirementsTable project={targetProject} />}
    </section>
  )
}

function ConstraintsStep({
  policyId,
  policies,
  formState,
  isCustomPolicy,
  onPolicyChange,
  onConstraintChange,
}: {
  policyId: string
  policies: MatchingPolicy[]
  formState: FormState
  isCustomPolicy: boolean
  onPolicyChange: (policyId: string) => void
  onConstraintChange: (nextState: Partial<FormState>) => void
}) {
  return (
    <section className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-6 duration-200">
      <StepHeading
        title="2. Constraints"
        description="Choose how the platform should search for possible moves."
      />

      <div className="grid gap-4 md:grid-cols-[14rem_1fr] md:items-center">
        <FieldLabel>Candidate pool</FieldLabel>
        <ReadOnlyField>All eligible employees</ReadOnlyField>
        <FieldLabel>Move timing</FieldLabel>
        <ReadOnlyField>
          Move requests are created only after the CTO opens a draft plan
        </ReadOnlyField>
        <FieldLabel>Impact tolerance</FieldLabel>
        <Select value={policyId} onValueChange={onPolicyChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select preset" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {policies.map((policy) => (
                <SelectItem key={policy.id} value={String(policy.id)}>
                  {policy.name}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_POLICY_VALUE}>
                Custom impact tolerance
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-3xl border bg-muted/40">
        <ConstraintRow
          label="Avoid breaking source company minimum requirements"
          description="Protect source teams from dropping below their staffing threshold."
          checked={formState.avoidBreakingMinimums}
          onCheckedChange={(checked) =>
            onConstraintChange({ avoidBreakingMinimums: checked })
          }
        />
        <ConstraintRow
          label="Exclude employees with open move requests"
          description="Keep employees with unresolved transitions out of the candidate pool."
          checked={formState.excludeOpenMoveRequests}
          onCheckedChange={(checked) =>
            onConstraintChange({ excludeOpenMoveRequests: checked })
          }
        />
        <ConstraintRow
          label="Prefer fewer company-to-company moves"
          description="Limit disruption by capping the number of proposed moves."
          checked={formState.preferFewerMoves}
          onCheckedChange={(checked) =>
            onConstraintChange({ preferFewerMoves: checked })
          }
        >
          <Select
            value={formState.maxMoves}
            disabled={!formState.preferFewerMoves}
            onValueChange={(maxMoves) => onConstraintChange({ maxMoves })}
          >
            <SelectTrigger size="sm" className="w-44">
              <SelectValue placeholder="Max moves" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Array.from(
                  { length: MAX_MATCHING_MOVES },
                  (_, index) => index + 1
                ).map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    Max {count} {count === 1 ? "move" : "moves"}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </ConstraintRow>
      </div>

      <Alert>
        <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
        <AlertTitle>Matching constraints</AlertTitle>
        <AlertDescription>
          These settings shape the matching policy for this plan. Saved presets reuse
          existing platform rules, while custom changes are saved as a plan-specific
          preset before recommendations are generated.
        </AlertDescription>
      </Alert>
      {isCustomPolicy && (
        <p className="text-xs text-muted-foreground">
          Custom impact tolerance selected. This preset will be saved with the plan
          when you generate recommendations.
        </p>
      )}
    </section>
  )
}

function GenerateStep({
  targetProject,
  policyLabel,
  isCustomPolicy,
  stage,
}: {
  targetProject?: Project
  policyLabel: string
  isCustomPolicy: boolean
  stage: GenerationStage
}) {
  const progress = getGenerationProgress(stage, isCustomPolicy)
  const stageRows = getGenerationStageRows({ stage, isCustomPolicy })

  return (
    <section className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-6 duration-200">
      <StepHeading
        title="3. Generate"
        description={`Finding employees who can cover ${
          targetProject?.project_name ?? "the target company"
        } minimum requirements.`}
      />

      <div className="flex items-center gap-4">
        <Progress
          value={progress}
          className="max-w-md transition-all duration-500 [&_[data-slot=progress-indicator]]:bg-green-600 [&_[data-slot=progress-indicator]]:transition-all [&_[data-slot=progress-indicator]]:duration-700"
        />
        <span className="text-sm text-muted-foreground">
          {getGenerationStatusLabel(stage, progress)}
        </span>
      </div>

      <ol className="flex flex-col divide-y overflow-hidden rounded-3xl border bg-muted/35">
        {stageRows.map((row, index) => (
          <GenerationStageRow
            key={row.id}
            row={row}
            index={index}
          />
        ))}
      </ol>

      <div className="rounded-3xl border bg-muted/35 p-4">
        <SummaryRow label="Target company" value={targetProject?.project_name ?? "Not set"} />
        <SummaryRow
          label="Required coverage"
          value={
            targetProject
              ? `${targetProject.required_people_amount} people, ${getRequiredSkillCount(
                  targetProject
                )} skill dimensions`
              : "Not set"
          }
        />
        <SummaryRow
          label="Matching policy"
          value={policyLabel}
        />
      </div>
    </section>
  )
}

function FinalStep({
  targetProject,
  formState,
  summary,
  previewPlan,
  warnings,
}: {
  targetProject: Project
  formState: FormState
  summary: {
    proposedMoves: number
    highestImpact: "low" | "medium" | "high"
    coveragePercent: number
  }
  previewPlan: MovePlan | null
  warnings: string[]
}) {
  const hasDraftPlan = Boolean(previewPlan)

  return (
    <section className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-6 duration-200">
      <Badge
        variant="outline"
        className={cn(
          "w-fit",
          hasDraftPlan
            ? "border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300"
            : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        )}
      >
        {hasDraftPlan ? "Plan created successfully" : "Matching complete"}
      </Badge>
      <StepHeading
        title={hasDraftPlan ? "Draft move plan ready" : "No viable draft plan found"}
        description={
          hasDraftPlan
            ? "Review the plan before sending requests to employees."
            : "Matching finished without a draft plan that can be reviewed or sent."
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Target company">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={targetProject.icon_url} alt="" />
              <AvatarFallback>{getInitials(targetProject.project_name)}</AvatarFallback>
            </Avatar>
            <span className="font-medium">{targetProject.project_name}</span>
          </div>
        </StatCard>
        <StatCard label="Plan name">
          <p className="font-medium">{formState.planName}</p>
        </StatCard>
        <StatCard label="Proposed moves">
          <p className="text-2xl font-semibold">{summary.proposedMoves}</p>
        </StatCard>
        <StatCard label="Requirement coverage">
          <p className="text-2xl font-semibold">{summary.coveragePercent}%</p>
        </StatCard>
        <StatCard label="Highest source impact">
          <p className="text-2xl font-semibold">{formatImpact(summary.highestImpact)}</p>
        </StatCard>
      </div>

      {previewPlan ? (
        <>
          <div>
            <h3 className="mb-3 font-medium">What&apos;s inside</h3>
            <DraftPreviewAccordion plan={previewPlan} />
          </div>

          <Alert>
            <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
            <AlertTitle>Nothing has been sent yet</AlertTitle>
            <AlertDescription>
              Requests will only be sent after you start the move request from the
              draft plan page.
            </AlertDescription>
          </Alert>
        </>
      ) : (
        <Alert>
          <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
          <AlertTitle>No draft plan is available</AlertTitle>
          <AlertDescription>
            {warnings.length > 0
              ? warnings.join(" ")
              : "This run finished without any viable recommendation to review."}
          </AlertDescription>
        </Alert>
      )}
    </section>
  )
}

function DraftPreviewAccordion({ plan }: { plan: MovePlan }) {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="requirement-coverage"
      className="rounded-3xl bg-muted/35"
    >
      <AccordionItem value="requirement-coverage">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <PreviewTrigger
            label="Requirement coverage"
            value={`${plan.coveragePercent}% covered`}
          />
        </AccordionTrigger>
        <AccordionContent className="pb-4">
          <div className="space-y-2">
            {plan.requirementCoverage
              .filter((row) => row.requiredSlots > 0)
              .map((row) => (
                <div
                  key={row.skill}
                  className="grid gap-2 rounded-2xl border bg-background px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{skillLabels[row.skill]}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatRequirement(plan.targetProject.required_skills[row.skill])}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.afterCovered} / {row.requiredSlots}
                  </p>
                  <PreviewStatusBadge>{formatCoverageStatus(row.status)}</PreviewStatusBadge>
                </div>
              ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="proposed-movements">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <PreviewTrigger
            label="Proposed movements"
            value={`${plan.movements.length} moves`}
          />
        </AccordionTrigger>
        <AccordionContent className="pb-4">
          <div className="space-y-2">
            {plan.movements.map((movement) => (
              <div
                key={movement.id}
                className="rounded-2xl border bg-background px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {movement.employee?.name ?? "Unknown employee"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {movement.sourceProject?.project_name ?? "Bench"} to{" "}
                      {movement.targetProject.project_name}
                    </p>
                  </div>
                  <PreviewStatusBadge>
                    {formatImpact(movement.currentProjectImpact)} impact
                  </PreviewStatusBadge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {movement.expectedRole}
                </p>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="affected-companies">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <PreviewTrigger
            label="Affected companies"
            value={
              plan.affectedCompanies.length > 0
                ? `${plan.affectedCompanies.length} impacted`
                : "No source impact"
            }
          />
        </AccordionTrigger>
        <AccordionContent className="pb-4">
          <div className="space-y-2">
            {plan.affectedCompanies.length > 0 ? (
              plan.affectedCompanies.map((company) => (
                <div
                  key={company.project?.id ?? "bench"}
                  className="rounded-2xl border bg-background px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {company.project?.project_name ?? "Bench"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {company.afterHeadcount} / {company.requiredHeadcount} people after
                        the plan
                      </p>
                    </div>
                    <PreviewStatusBadge>
                      {formatImpact(company.risk)} risk
                    </PreviewStatusBadge>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border bg-background px-3 py-3 text-sm text-muted-foreground">
                No source company loses capacity.
              </p>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="employee-impact">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <PreviewTrigger
            label="Employee impact"
            value={`${plan.employeeImpacts.length} employees`}
          />
        </AccordionTrigger>
        <AccordionContent className="pb-4">
          <div className="space-y-2">
            {plan.employeeImpacts.map((impact) => (
              <div
                key={impact.movement.id}
                className="rounded-2xl border bg-background px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {impact.employee?.name ?? "Unknown employee"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {impact.transitionEffort} transition effort
                    </p>
                  </div>
                  <PreviewStatusBadge>
                    {formatRequestStatus(impact.status)}
                  </PreviewStatusBadge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {impact.handoffNeeds}
                </p>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function PreviewTrigger({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span>{label}</span>
      <span className="text-sm text-muted-foreground">{value}</span>
    </div>
  )
}

function PreviewStatusBadge({ children }: { children: ReactNode }) {
  return (
    <Badge variant="outline" className="shrink-0">
      {children}
    </Badge>
  )
}

function formatCoverageStatus(
  status: "covered" | "partially_covered" | "missing" | "not_required"
) {
  if (status === "covered") return "Covered"
  if (status === "partially_covered") return "Partially covered"
  if (status === "missing") return "Missing"
  return "Not required"
}

type GenerationRowState = "pending" | "active" | "complete" | "failed" | "skipped"

type GenerationStageRowModel = {
  id: string
  label: string
  description: string
  state: GenerationRowState
}

function GenerationStageRow({
  row,
  index,
}: {
  row: GenerationStageRowModel
  index: number
}) {
  return (
    <li
      className={cn(
        "animate-in fade-in-0 slide-in-from-bottom-1 flex items-start gap-3 px-4 py-3 transition-all duration-300",
        row.state === "active" && "bg-green-500/10",
        row.state === "failed" && "bg-red-500/10",
        row.state === "pending" && "opacity-65"
      )}
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs transition-all duration-300",
          row.state === "complete" &&
            "border-green-600 bg-green-600 text-white",
          row.state === "active" &&
            "animate-pulse border-green-600 bg-green-600 text-white ring-4 ring-green-600/15",
          row.state === "failed" && "border-red-600 bg-red-600 text-white",
          row.state === "skipped" && "border-border bg-background text-muted-foreground"
        )}
      >
        {row.state === "complete" ? (
          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
        ) : row.state === "failed" ? (
          "!"
        ) : (
          index + 1
        )}
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            "font-medium transition-colors",
            row.state === "failed" && "text-red-700 dark:text-red-300"
          )}
        >
          {row.label}
        </p>
        <p className="text-sm text-muted-foreground">{row.description}</p>
      </div>
    </li>
  )
}

function MinimumRequirementsTable({ project }: { project: Project }) {
  return (
    <div className="overflow-hidden rounded-3xl border bg-muted/35">
      <div className="border-b px-4 py-3 font-medium">Minimum requirements</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Skill</TableHead>
            <TableHead>Requirement</TableHead>
            <TableHead className="text-right">People</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {skillKeys.map((skill) => {
            const requirement = project.required_skills[skill]
            const total = getRequirementTotal(requirement)

            return (
              <TableRow key={skill}>
                <TableCell>{skillLabels[skill]}</TableCell>
                <TableCell>
                  {total > 0 ? (
                    <RequirementBadges requirement={requirement} />
                  ) : (
                    <span className="text-muted-foreground">Not required</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {total > 0 ? `${total} ${total === 1 ? "person" : "people"}` : "—"}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function RequirementBadges({ requirement }: { requirement: ProjectSkillRequirement }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {([1, 2, 3] as const).map((level) => {
        const count = requirement[`level_${level}`]
        return count > 0 ? (
          <Badge
            key={level}
            variant="outline"
            className="border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300"
          >
            L{level} x {count}
          </Badge>
        ) : null
      })}
    </div>
  )
}

function StepHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium">{children}</p>
}

function ReadOnlyField({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border bg-input/40 px-3 py-2 text-sm">{children}</div>
  )
}

function ConstraintRow({
  label,
  description,
  checked,
  onCheckedChange,
  children,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex min-w-0 items-start gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          className="mt-0.5"
        />
        <span className="min-w-0">
          <span className="block font-medium">{label}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {description}
          </span>
        </span>
      </label>
      {children ? <div className="shrink-0 sm:ml-4">{children}</div> : null}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-4 border-b py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

function StatCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border bg-muted/35 p-4">
      <p className="mb-2 text-sm text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function ProjectSelectOption({ project }: { project: Project }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-6">
        <AvatarImage src={project.icon_url} alt="" />
        <AvatarFallback className="text-[0.625rem]">
          {getInitials(project.project_name)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate">{project.project_name}</span>
    </span>
  )
}

function getRequiredSkillCount(project: Project) {
  return skillKeys.filter((skill) => getRequirementTotal(project.required_skills[skill]) > 0)
    .length
}

function getGenerateButtonLabel(stage: GenerationStage, hasGeneratedDraft: boolean) {
  if (stage === "ready") {
    return hasGeneratedDraft ? "Review draft plan" : "Review result"
  }
  if (stage === "failed") return "Retry generation"
  if (runningGenerationStages.includes(stage)) return "Generating..."
  return "Generate draft plan"
}

function getGenerationStatusLabel(stage: GenerationStage, progress: number) {
  if (stage === "idle") return "Ready"
  if (stage === "ready") return "Complete"
  if (stage === "failed") return "Failed"
  return `${progress}%`
}

function getGenerationProgress(stage: GenerationStage, isCustomPolicy: boolean) {
  if (stage === "idle") return 0
  if (stage === "failed") return 100
  if (stage === "ready") return 100
  if (stage === "creating_policy") return isCustomPolicy ? 18 : 28
  if (stage === "running_matching") return isCustomPolicy ? 58 : 68
  return 88
}

function getGenerationStageRows({
  stage,
  isCustomPolicy,
}: {
  stage: GenerationStage
  isCustomPolicy: boolean
}): GenerationStageRowModel[] {
  return [
    {
      id: "policy",
      label: isCustomPolicy ? "Save custom impact tolerance" : "Load saved matching preset",
      description: isCustomPolicy
        ? "Creates a plan-specific preset so this run uses your edited constraints."
        : "Uses the selected platform policy for candidate search and impact checks.",
      state: getRowState({
        stage,
        active: "creating_policy",
        completeAfter: ["running_matching", "saving_plan", "ready"],
        skipped: !isCustomPolicy,
      }),
    },
    {
      id: "matching",
      label: "Find matching employees",
      description: "Compares employee skills, assignments, preferences, and availability.",
      state: getRowState({
        stage,
        active: "running_matching",
        completeAfter: ["saving_plan", "ready"],
      }),
    },
    {
      id: "impact",
      label: "Check source company impact",
      description: "Verifies proposed moves do not create avoidable staffing risk elsewhere.",
      state: getRowState({
        stage,
        active: "running_matching",
        completeAfter: ["saving_plan", "ready"],
      }),
    },
    {
      id: "save",
      label: "Save draft move plan",
      description: "Persists the generated plan and keeps employee requests unsent.",
      state: getRowState({
        stage,
        active: "saving_plan",
        completeAfter: ["ready"],
      }),
    },
  ]
}

function getRowState({
  stage,
  active,
  completeAfter,
  skipped = false,
}: {
  stage: GenerationStage
  active: GenerationStage
  completeAfter: GenerationStage[]
  skipped?: boolean
}): GenerationRowState {
  if (stage === "failed" && !skipped) return "failed"
  if (skipped) return stage === "idle" ? "skipped" : "complete"
  if (stage === active) return "active"
  if (completeAfter.includes(stage)) return "complete"
  return "pending"
}

function getPolicyConstraintState(policy?: MatchingPolicy): Pick<
  FormState,
  | "avoidBreakingMinimums"
  | "excludeOpenMoveRequests"
  | "preferFewerMoves"
  | "maxMoves"
> {
  const maxMoves = Number(policy?.config.max_moves ?? 3)

  return {
    avoidBreakingMinimums:
      policy?.config.allow_understaff_current_project === undefined
        ? true
        : policy.config.allow_understaff_current_project === false,
    excludeOpenMoveRequests: policy?.config.exclude_pending_move_requests !== false,
    preferFewerMoves: Number.isFinite(maxMoves),
    maxMoves: String(Number.isFinite(maxMoves) ? maxMoves : 3),
  }
}

function getCustomPolicyConfig(formState: FormState, basePolicy?: MatchingPolicy) {
  return {
    ...(basePolicy?.config ?? {}),
    allow_understaff_current_project: !formState.avoidBreakingMinimums,
    exclude_pending_move_requests: formState.excludeOpenMoveRequests,
    max_moves: formState.preferFewerMoves
      ? Number(formState.maxMoves)
      : MAX_MATCHING_MOVES,
  }
}

function getCustomPolicyName(planName: string) {
  const suffix = Date.now()
  const prefix = "Custom matching preset"
  const cleanPlanName = planName.trim() || "Untitled move plan"
  const maxPlanNameLength = 255 - prefix.length - String(suffix).length - 6

  return `${prefix} - ${cleanPlanName.slice(0, maxPlanNameLength)} - ${suffix}`
}

function getInitials(value: string) {
  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}
