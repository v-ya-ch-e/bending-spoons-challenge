"use client"

import { useMemo, useState, type ReactNode } from "react"
import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Briefcase01Icon,
  ChartRelationshipIcon,
  CheckListIcon,
  DashboardSquare01Icon,
  DocumentValidationIcon,
  Folder01Icon,
  Notification03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import {
  BackendApiError,
  skillKeys,
  suggestProjectRequirements,
  type RoleRequirement,
  type StaffingSuggestion,
} from "@/lib/backend-api"
import {
  createProject,
  DbApiError,
  updateProject,
  type Project,
  type ProjectCreateInput,
  type ProjectPhase,
  type ProjectSkillRequirement,
  type ProjectSkillRequirements,
  type ProjectUpdateInput,
  type SkillKey,
} from "@/lib/db-api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type CreateProjectDialogProps = {
  open: boolean
  project?: Project
  mode?: "create" | "edit"
  onOpenChange: (open: boolean) => void
  onCreated: (project: Project) => void
}

type StepId = "company" | "sources" | "requirements" | "review"

type FormState = {
  projectName: string
  websiteUrl: string
  projectPhase: ProjectPhase
  description: string
  iconUrl: string
  posterUrl: string
  githubRepoDraft: string
  githubRepoUrls: string[]
  notionSource: string
  slackSource: string
  includeNotion: boolean
  includeSlack: boolean
}

const skillLabels: Record<SkillKey, string> = {
  android: "Android",
  ios: "iOS",
  web: "Web",
  backend: "Backend",
  infrastructure: "Infrastructure",
  ai: "AI",
}

const skillDescriptions: Record<SkillKey, string> = {
  android: "Native Android apps, Kotlin, Play Store delivery.",
  ios: "iOS apps, Swift, release workflows, platform patterns.",
  web: "Frontend apps, React, accessibility, interface systems.",
  backend: "APIs, services, persistence, reliability work.",
  infrastructure: "Cloud, CI/CD, observability, operational tooling.",
  ai: "Model integrations, evaluation, applied AI product work.",
}

const skillIconMap = {
  android: DashboardSquare01Icon,
  ios: Briefcase01Icon,
  web: Folder01Icon,
  backend: ChartRelationshipIcon,
  infrastructure: DocumentValidationIcon,
  ai: Notification03Icon,
}

const skillRequirementLevels = [1, 2, 3] as const
type SkillRequirementLevel = (typeof skillRequirementLevels)[number]
type SkillRequirementLevelField = `level_${SkillRequirementLevel}`

const skillLevelLabels: Record<SkillRequirementLevel, string> = {
  1: "Basic",
  2: "Working",
  3: "Expert",
}

const steps: Array<{
  id: StepId
  label: string
  description: string
  icon: typeof Folder01Icon
}> = [
  {
    id: "company",
    label: "Company",
    description: "Workspace details.",
    icon: Briefcase01Icon,
  },
  {
    id: "sources",
    label: "Sources",
    description: "Connect repository context.",
    icon: ChartRelationshipIcon,
  },
  {
    id: "requirements",
    label: "Requirements",
    description: "Extract and tune staffing.",
    icon: CheckListIcon,
  },
  {
    id: "review",
    label: "Review",
    description: "Confirm before creation.",
    icon: DocumentValidationIcon,
  },
]

const emptyProjectSkillRequirements: ProjectSkillRequirements = {
  android: { level_1: 0, level_2: 0, level_3: 0 },
  ios: { level_1: 0, level_2: 0, level_3: 0 },
  web: { level_1: 0, level_2: 0, level_3: 0 },
  backend: { level_1: 0, level_2: 0, level_3: 0 },
  infrastructure: { level_1: 0, level_2: 0, level_3: 0 },
  ai: { level_1: 0, level_2: 0, level_3: 0 },
}

function getInitialFormState(project?: Project): FormState {
  if (!project) {
    return {
      projectName: "",
      websiteUrl: "",
      projectPhase: "new acquisition",
      description: "",
      iconUrl: "",
      posterUrl: "",
      githubRepoDraft: "",
      githubRepoUrls: [],
      notionSource: "",
      slackSource: "",
      includeNotion: false,
      includeSlack: false,
    }
  }

  return {
    projectName: project.project_name,
    websiteUrl: getProjectWebsite(project),
    projectPhase: project.project_phase,
    description: project.project_description,
    iconUrl: project.icon_url,
    posterUrl: project.poster_url,
    githubRepoDraft: "",
    githubRepoUrls: project.github_repositories,
    notionSource: "",
    slackSource: "",
    includeNotion: false,
    includeSlack: false,
  }
}

export function CreateProjectDialog({
  open,
  project,
  mode = "create",
  onOpenChange,
  onCreated,
}: CreateProjectDialogProps) {
  const isEditMode = mode === "edit" && project
  const [stepIndex, setStepIndex] = useState(0)
  const [formState, setFormState] = useState<FormState>(() =>
    getInitialFormState(project)
  )
  const [suggestion, setSuggestion] = useState<StaffingSuggestion | null>(null)
  const [requirements, setRequirements] = useState<ProjectSkillRequirements>(
    () => project?.required_skills ?? cloneProjectSkillRequirements(emptyProjectSkillRequirements)
  )
  const [requiredPeopleAmount, setRequiredPeopleAmount] = useState(
    () => project?.required_people_amount ?? 0
  )
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isManualRequirementsEnabled, setIsManualRequirementsEnabled] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentStep = steps[stepIndex]
  const isFirstStep = stepIndex === 0
  const isReviewStep = currentStep.id === "review"
  const isRequirementsStep = currentStep.id === "requirements"
  const hasRequirements =
    Boolean(suggestion) || Boolean(isEditMode) || isManualRequirementsEnabled

  const media = useMemo(
    () => getProjectMedia(formState.websiteUrl),
    [formState.websiteUrl]
  )
  const resolvedIconUrl = formState.iconUrl || media.iconUrl
  const resolvedPosterUrl = formState.posterUrl || media.posterUrl
  const normalizedGithubRepoUrls = useMemo(
    () => normalizeGithubUrls(formState.githubRepoUrls),
    [formState.githubRepoUrls]
  )

  function updateFormState(
    nextState:
      | Partial<FormState>
      | ((current: FormState) => Partial<FormState>)
  ) {
    setFormState((current) => ({
      ...current,
      ...(typeof nextState === "function" ? nextState(current) : nextState),
    }))
    setValidationError(null)
  }

  function updateRequirement(
    skill: SkillKey,
    nextRequirement: Partial<ProjectSkillRequirement>
  ) {
    setIsManualRequirementsEnabled(true)
    setRequirements((current) => ({
      ...current,
      [skill]: normalizeProjectSkillRequirement({
        ...current[skill],
        ...nextRequirement,
      }),
    }))
  }

  function validateStep(step: StepId): string | null {
    if (step === "company") {
      if (!formState.projectName.trim()) {
        return "Enter the company or product name."
      }

      if (!normalizeDomain(formState.websiteUrl)) {
        return "Enter a valid website domain or URL."
      }

      if (!formState.description.trim()) {
        return "Enter a short description for the company workspace."
      }
    }

    if (step === "sources" && normalizedGithubRepoUrls.length === 0) {
      return "Add at least one GitHub repository URL or owner/repo path."
    }

    if ((step === "requirements" || step === "review") && !hasRequirements) {
      return "Extract requirements before continuing."
    }

    return null
  }

  function canNavigateToStep(targetStepIndex: number) {
    if (targetStepIndex <= stepIndex) {
      return true
    }

    return steps
      .slice(0, targetStepIndex)
      .every((step) => validateStep(step.id) === null)
  }

  function handleStepChange(targetStepIndex: number) {
    if (targetStepIndex === stepIndex) {
      return
    }

    if (!canNavigateToStep(targetStepIndex)) {
      setValidationError(validateStep(currentStep.id))
      return
    }

    setValidationError(null)
    setSubmitError(null)
    setStepIndex(targetStepIndex)
  }

  async function handleNext() {
    const nextValidationError = validateStep(currentStep.id)

    if (nextValidationError) {
      setValidationError(nextValidationError)
      return
    }

    if (currentStep.id === "sources" && !suggestion && !isEditMode) {
      await handleExtractRequirements()
      return
    }

    setValidationError(null)
    setStepIndex((current) => Math.min(current + 1, steps.length - 1))
  }

  function handleBack() {
    setValidationError(null)
    setSubmitError(null)
    setStepIndex((current) => Math.max(current - 1, 0))
  }

  async function handleExtractRequirements() {
    const companyValidationError = validateStep("company")
    const sourcesValidationError = validateStep("sources")

    if (companyValidationError || sourcesValidationError) {
      setValidationError(companyValidationError ?? sourcesValidationError)
      return
    }

    try {
      setIsExtracting(true)
      setValidationError(null)
      setSubmitError(null)
      setStepIndex(2)
      const nextSuggestion = await suggestProjectRequirements({
        github_repo_urls: normalizedGithubRepoUrls,
        project_phase: formState.projectPhase,
        task_description: formState.description,
      })

      setSuggestion(nextSuggestion)
      setRequirements(nextSuggestion.required_skills)
      setRequiredPeopleAmount(nextSuggestion.total_headcount)
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 501) {
        setSubmitError("Requirement extraction is not available in this backend.")
      } else {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Unable to extract project requirements."
        )
      }
      setIsManualRequirementsEnabled(true)
    } finally {
      setIsExtracting(false)
    }
  }

  function handleManualRequirements() {
    setIsManualRequirementsEnabled(true)
    setValidationError(null)
    setSubmitError(null)
    setStepIndex(2)
  }

  async function handleSave() {
    const validationErrors = steps
      .map((step) => validateStep(step.id))
      .filter((error): error is string => Boolean(error))

    if (validationErrors.length > 0) {
      setValidationError(validationErrors[0])
      return
    }

    const payload: ProjectCreateInput | ProjectUpdateInput = {
      project_name: formState.projectName.trim(),
      project_description: formState.description.trim(),
      project_phase: formState.projectPhase,
      icon_url: resolvedIconUrl,
      poster_url: resolvedPosterUrl,
      current_team_member_ids: project?.current_team_member_ids ?? [],
      required_people_amount: requiredPeopleAmount,
      required_skills: requirements,
      github_repositories: normalizedGithubRepoUrls,
    }

    try {
      setIsSubmitting(true)
      setSubmitError(null)
      const savedProject =
        isEditMode && project
          ? await updateProject(project.id, payload)
          : await createProject(payload as ProjectCreateInput)
      onCreated(savedProject)
    } catch (error) {
      if (error instanceof DbApiError && error.status === 409) {
        setSubmitError("A project with this name already exists.")
      } else {
        setSubmitError(
          error instanceof Error
            ? error.message
            : `Unable to ${isEditMode ? "save" : "create"} the project.`
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(47rem,calc(100svh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-lg">
            {isEditMode ? "Edit company" : "Add company"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditMode
              ? "Edit a project workspace and its staffing requirements."
              : "Create a project workspace and extract initial staffing requirements."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 md:grid-cols-[17rem_1fr]">
          <StepNavigation
            currentStepIndex={stepIndex}
            canNavigateToStep={canNavigateToStep}
            onStepChange={handleStepChange}
          />

          <div className="min-h-0 border-t border-border md:border-t-0 md:border-l">
            <div className="h-full overflow-y-auto px-6 py-6 md:px-8">
              <div className="mx-auto max-w-3xl">
                {validationError && (
                  <Alert variant="destructive" className="mb-5">
                    <AlertTitle>Check this step</AlertTitle>
                    <AlertDescription>{validationError}</AlertDescription>
                  </Alert>
                )}

                {submitError && (
                  <Alert variant="destructive" className="mb-5">
                    <AlertTitle>Could not continue</AlertTitle>
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                )}

                {currentStep.id === "company" && (
                  <CompanyStep
                    formState={formState}
                    domain={media.domain}
                    iconUrl={resolvedIconUrl}
                    onChange={updateFormState}
                  />
                )}

                {currentStep.id === "sources" && (
                  <SourcesStep
                    formState={formState}
                    normalizedGithubRepoUrls={normalizedGithubRepoUrls}
                    onChange={updateFormState}
                  />
                )}

                {currentStep.id === "requirements" && (
                  <RequirementsStep
                    isExtracting={isExtracting}
                    hasRequirements={hasRequirements}
                    suggestion={suggestion}
                    requirements={requirements}
                    requiredPeopleAmount={requiredPeopleAmount}
                    onExtract={handleExtractRequirements}
                    onManualEntry={handleManualRequirements}
                    onPeopleAmountChange={setRequiredPeopleAmount}
                    onRequirementChange={updateRequirement}
                  />
                )}

                {currentStep.id === "review" && (
                  <ReviewStep
                    formState={formState}
                    iconUrl={resolvedIconUrl}
                    githubRepoUrls={normalizedGithubRepoUrls}
                    suggestion={suggestion}
                    requirements={requirements}
                    requiredPeopleAmount={requiredPeopleAmount}
                    onEditStep={setStepIndex}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExtracting || isSubmitting}
          >
            Cancel
          </Button>
          <div className="flex flex-1 justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isFirstStep || isExtracting || isSubmitting}
            >
              Back
            </Button>
            {isReviewStep ? (
              <Button type="button" onClick={handleSave} disabled={isSubmitting}>
                {isSubmitting
                  ? isEditMode
                    ? "Saving..."
                    : "Creating..."
                  : isEditMode
                    ? "Save changes"
                    : "Create company"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleNext}
                disabled={isExtracting || (isRequirementsStep && !hasRequirements)}
              >
                {currentStep.id === "sources"
                  ? isEditMode
                    ? "Continue"
                    : isExtracting
                    ? "Extracting..."
                    : "Extract requirements"
                  : "Continue"}
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
              isActive && "bg-accent",
              !isActive && !isLocked && "hover:bg-muted",
              isLocked && "opacity-45"
            )}
            aria-current={isActive ? "step" : undefined}
            aria-disabled={isLocked}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full border text-sm font-medium",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : isCompleted
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
              )}
            >
              {isCompleted ? (
                <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-3.5" />
              ) : (
                index + 1
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 truncate font-medium">
                <HugeiconsIcon icon={step.icon} strokeWidth={2} className="size-3.5" />
                {step.label}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {step.description}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}

function CompanyStep({
  formState,
  domain,
  iconUrl,
  onChange,
}: {
  formState: FormState
  domain: string
  iconUrl: string
  onChange: (partialState: Partial<FormState>) => void
}) {
  const hasLogoPreview = Boolean(iconUrl)

  return (
    <section className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-6 duration-200">
      <StepHeading
        title="Company"
        description="Create a company workspace and define the initial staffing scope."
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div className="flex flex-col gap-5">
          <section className="rounded-3xl border border-border p-4">
            <div className="mb-4">
              <h3 className="font-medium">Company identity</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This becomes the workspace name, product context, and acquisition phase.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company name" required>
                <Input
                  value={formState.projectName}
                  onChange={(event) => onChange({ projectName: event.target.value })}
                  placeholder="Eventbrite"
                  aria-label="Company name"
                />
              </Field>
              <Field label="Website URL" required>
                <Input
                  value={formState.websiteUrl}
                  onChange={(event) => onChange({ websiteUrl: event.target.value })}
                  placeholder="eventbrite.com"
                  aria-label="Website URL"
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Phase" required>
                <Select
                  value={formState.projectPhase}
                  onValueChange={(value) =>
                    onChange({ projectPhase: value as ProjectPhase })
                  }
                >
                  <SelectTrigger aria-label="Phase" className="w-full sm:w-64">
                    <SelectValue placeholder="Select phase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="new acquisition">New acquisition</SelectItem>
                      <SelectItem value="growth">Growth</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </section>

          <section className="rounded-3xl border border-border p-4">
            <div className="mb-4">
              <h3 className="font-medium">Staffing scope</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep this short. It is sent to the requirements extraction backend.
              </p>
            </div>
            <Field label="Short description" required>
              <Textarea
                value={formState.description}
                onChange={(event) => onChange({ description: event.target.value })}
                placeholder="Understand the codebase, stabilize billing, and prepare the initial integration roadmap."
                aria-label="Short description"
                className="min-h-32"
              />
            </Field>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="rounded-3xl border border-border p-4">
            <div>
              <h3 className="font-medium">Brand assets</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                A logo is generated after a valid website domain is available.
              </p>
            </div>
            <div className="mt-4 rounded-3xl bg-muted p-4">
              {hasLogoPreview ? (
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    <AvatarImage src={iconUrl} alt="" />
                    <AvatarFallback>
                      {getInitials(formState.projectName || "Company")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {domain ? `Generated from ${domain}` : "Custom logo"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{iconUrl}</p>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-20 items-center gap-3 text-muted-foreground">
                  <div className="grid size-10 place-items-center rounded-2xl bg-background">
                    <HugeiconsIcon icon={Briefcase01Icon} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      No logo generated yet
                    </p>
                    <p className="text-xs">
                      Enter a website URL or paste a direct logo URL.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
          <Field
            label="Logo URL"
            description="Optional. Defaults to the domain favicon."
          >
            <Input
              value={formState.iconUrl}
              onChange={(event) => onChange({ iconUrl: event.target.value })}
              placeholder="https://..."
              aria-label="Logo URL"
            />
          </Field>
        </aside>
      </div>
    </section>
  )
}

function SourcesStep({
  formState,
  normalizedGithubRepoUrls,
  onChange,
}: {
  formState: FormState
  normalizedGithubRepoUrls: string[]
  onChange: (
    partialState: Partial<FormState> | ((current: FormState) => Partial<FormState>)
  ) => void
}) {
  const normalizedDraftRepoUrl = normalizeGithubUrl(formState.githubRepoDraft)

  function handleAddRepository() {
    if (!normalizedDraftRepoUrl) {
      return
    }

    onChange((current) => ({
      githubRepoDraft: "",
      githubRepoUrls: normalizeGithubUrls([
        ...current.githubRepoUrls,
        normalizedDraftRepoUrl,
      ]),
    }))
  }

  function handleRemoveRepository(repositoryUrl: string) {
    onChange((current) => ({
      githubRepoUrls: current.githubRepoUrls.filter(
        (currentUrl) => normalizeGithubUrl(currentUrl) !== repositoryUrl
      ),
    }))
  }

  return (
    <section className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-6 duration-200">
      <StepHeading
        title="Connect sources"
        description="Select the sources that will be analyzed to extract the initial staffing requirements."
      />
      <div className="flex flex-col gap-3">
        <SourceCard
          logoSrc="/logo_github.png"
          title="GitHub"
          description="Required for extracting technical requirements."
          status={
            normalizedGithubRepoUrls.length > 0
              ? `${normalizedGithubRepoUrls.length} connected`
              : "Required"
          }
          checked
        >
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                value={formState.githubRepoDraft}
                onChange={(event) => onChange({ githubRepoDraft: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    handleAddRepository()
                  }
                }}
                placeholder="https://github.com/eventbrite/core-platform"
                aria-label="GitHub repository"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={handleAddRepository}
                disabled={!normalizedDraftRepoUrl}
                aria-label="Add GitHub repository"
              >
                +
              </Button>
            </div>
            {normalizedGithubRepoUrls.length > 0 && (
              <div className="flex flex-col gap-2">
                {normalizedGithubRepoUrls.map((repositoryUrl) => (
                  <div
                    key={repositoryUrl}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-sm">{repositoryUrl}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => handleRemoveRepository(repositoryUrl)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SourceCard>

        <SourceCard
          logoSrc="/logo_notion.png"
          title="Notion"
          description="Optional, improves business and documentation context."
          status={formState.includeNotion ? "Selected" : "Optional"}
          checked={formState.includeNotion}
          onCheckedChange={(checked) => onChange({ includeNotion: checked })}
        >
          <Input
            value={formState.notionSource}
            onChange={(event) => onChange({ notionSource: event.target.value })}
            placeholder="Eventbrite Acquisition Notes"
            aria-label="Notion source"
            disabled={!formState.includeNotion}
          />
        </SourceCard>

        <SourceCard
          logoSrc="/logo_slack.png"
          title="Slack"
          description="Optional, adds operational context for the demo."
          status={formState.includeSlack ? "Selected" : "Optional"}
          checked={formState.includeSlack}
          onCheckedChange={(checked) => onChange({ includeSlack: checked })}
        >
          <Input
            value={formState.slackSource}
            onChange={(event) => onChange({ slackSource: event.target.value })}
            placeholder="#eventbrite-integration"
            aria-label="Slack source"
            disabled={!formState.includeSlack}
          />
        </SourceCard>
      </div>
      <Alert>
        <AlertTitle>GitHub drives extraction</AlertTitle>
        <AlertDescription>
          The current backend analyzes GitHub repositories, project phase, and
          description. Notion and Slack are kept as review context until backend
          support is added.
        </AlertDescription>
      </Alert>
    </section>
  )
}

function RequirementsStep({
  isExtracting,
  hasRequirements,
  suggestion,
  requirements,
  requiredPeopleAmount,
  onExtract,
  onManualEntry,
  onPeopleAmountChange,
  onRequirementChange,
}: {
  isExtracting: boolean
  hasRequirements: boolean
  suggestion: StaffingSuggestion | null
  requirements: ProjectSkillRequirements
  requiredPeopleAmount: number
  onExtract: () => void
  onManualEntry: () => void
  onPeopleAmountChange: (value: number) => void
  onRequirementChange: (
    skill: SkillKey,
    nextRequirement: Partial<ProjectSkillRequirement>
  ) => void
}) {
  return (
    <section className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-6 duration-200">
      <StepHeading
        title={isExtracting ? "Extracting requirements" : "Requirements"}
        description={
          isExtracting
            ? "Analyzing the connected repository to estimate the minimum staffing requirements."
            : hasRequirements
              ? suggestion
                ? "Review the minimum staffing requirements extracted from the backend."
                : "Add the minimum staffing requirements manually."
              : "Extract requirements from GitHub or enter them manually."
        }
      />

      {isExtracting ? (
        <div className="flex flex-col gap-5 rounded-3xl border border-border p-5">
          <div className="flex items-center gap-4">
            <Progress value={72} className="h-2" />
            <span className="text-sm font-medium">72%</span>
          </div>
          <ExtractionChecklist />
        </div>
      ) : hasRequirements ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat
              label={suggestion ? "Suggested roles" : "Entry mode"}
              value={suggestion ? `${suggestion.roles.length}` : "Manual"}
            />
            <MiniStat label="Minimum team" value={`${requiredPeopleAmount} people`} />
            <MiniStat label="Required skills" value={`${countRequiredSkills(requirements)}`} />
          </div>

          <section className="rounded-3xl border border-border p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">Minimum staffing requirement</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Higher-level employees can satisfy lower-level requirements during matching.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => onPeopleAmountChange(Math.max(0, requiredPeopleAmount - 1))}
                  aria-label="Decrease required people"
                >
                  -
                </Button>
                <span className="grid size-9 place-items-center rounded-2xl bg-muted text-sm font-medium">
                  {requiredPeopleAmount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => onPeopleAmountChange(requiredPeopleAmount + 1)}
                  aria-label="Increase required people"
                >
                  +
                </Button>
              </div>
            </div>
            <div className="grid gap-3">
              {skillKeys.map((skill) => (
                <SkillRequirementControl
                  key={skill}
                  skill={skill}
                  requirement={requirements[skill]}
                  onChange={(nextRequirement) =>
                    onRequirementChange(skill, nextRequirement)
                  }
                />
              ))}
            </div>
          </section>

          {suggestion && (
            <section className="rounded-3xl border border-border p-4">
              <h3 className="font-medium">Backend recommendation</h3>
              <p className="mt-2 text-sm text-muted-foreground">{suggestion.summary}</p>
              <div className="mt-4 flex flex-col gap-3">
                {suggestion.roles.map((role, index) => (
                  <RoleCard key={`${role.role_name}-${index}`} role={role} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-3xl border border-border p-8 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted">
            <HugeiconsIcon icon={CheckListIcon} strokeWidth={2} />
          </div>
          <div>
            <h3 className="font-medium">No requirements extracted yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Run extraction from the connected GitHub repositories.
            </p>
          </div>
          <Button type="button" onClick={onExtract}>
            Extract requirements
          </Button>
          <Button type="button" variant="outline" onClick={onManualEntry}>
            Enter manually
          </Button>
        </div>
      )}
    </section>
  )
}

function ReviewStep({
  formState,
  iconUrl,
  githubRepoUrls,
  suggestion,
  requirements,
  requiredPeopleAmount,
  onEditStep,
}: {
  formState: FormState
  iconUrl: string
  githubRepoUrls: string[]
  suggestion: StaffingSuggestion | null
  requirements: ProjectSkillRequirements
  requiredPeopleAmount: number
  onEditStep: (stepIndex: number) => void
}) {
  return (
    <section className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-5 duration-200">
      <StepHeading
        title="Review"
        description="Confirm the company workspace and minimum staffing requirements before creation."
      />
      <SummaryCard title="Company" onEdit={() => onEditStep(0)}>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={iconUrl} alt="" />
            <AvatarFallback>{getInitials(formState.projectName || "Company")}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">
              {formState.projectName || "Not set"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {normalizeDomain(formState.websiteUrl) || "No website"}
            </p>
          </div>
        </div>
        <SummaryRow label="Phase" value={formatPhase(formState.projectPhase)} />
        <SummaryRow label="Description" value={formState.description || "Not set"} />
      </SummaryCard>

      <SummaryCard title="Sources" onEdit={() => onEditStep(1)}>
        <SummaryRow
          label="GitHub"
          value={githubRepoUrls.length > 0 ? githubRepoUrls.join(", ") : "Not set"}
        />
        <SummaryRow
          label="Notion"
          value={formState.includeNotion ? formState.notionSource || "Selected" : "Skipped"}
        />
        <SummaryRow
          label="Slack"
          value={formState.includeSlack ? formState.slackSource || "Selected" : "Skipped"}
        />
      </SummaryCard>

      <SummaryCard title="Minimum requirements" onEdit={() => onEditStep(2)}>
        <SummaryRow
          label="Headcount"
          value={`${requiredPeopleAmount} ${requiredPeopleAmount === 1 ? "person" : "people"}`}
        />
        <div className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
          <span className="text-muted-foreground">Skills</span>
          <div className="flex flex-wrap gap-1.5">
            {skillKeys.map((skill) => {
              const requirement = requirements[skill]

              return (
                <Badge
                  key={skill}
                  variant={getRequirementTotal(requirement) > 0 ? "secondary" : "outline"}
                >
                  {formatRequirementBadge(skill, requirement)}
                </Badge>
              )
            })}
          </div>
        </div>
        {suggestion && (
          <SummaryRow label="Summary" value={suggestion.summary || "No summary"} />
        )}
      </SummaryCard>

      <Alert>
        <AlertTitle>What happens next</AlertTitle>
        <AlertDescription>
          The company workspace, repositories, generated logo, and minimum staffing
          requirements will be saved to the current projects API.
        </AlertDescription>
      </Alert>
    </section>
  )
}

function SourceCard({
  logoSrc,
  title,
  description,
  status,
  checked,
  onCheckedChange,
  children,
}: {
  logoSrc: string
  title: string
  description: string
  status: string
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <div className="grid gap-4 rounded-3xl border border-border p-4 md:grid-cols-[1fr_20rem] md:items-center">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-background ring-1 ring-border">
          <Image
            src={logoSrc}
            alt=""
            width={24}
            height={24}
            className="size-6 object-contain"
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium">{title}</h3>
            {onCheckedChange && (
              <Button
                type="button"
                variant={checked ? "ghost" : "outline"}
                size={checked ? "xs" : "icon-sm"}
                onClick={() => onCheckedChange(!checked)}
                aria-label={`${checked ? "Remove" : "Add"} ${title}`}
              >
                {checked ? "Remove" : "+"}
              </Button>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <Badge className="mt-3" variant={checked ? "secondary" : "outline"}>
            {status}
          </Badge>
        </div>
      </div>
      <div>{children}</div>
    </div>
  )
}

function ExtractionChecklist() {
  const items = [
    "Reading repository structure",
    "Detecting languages and frameworks",
    "Reading README context",
    "Estimating required skill levels",
    "Estimating needed capacity",
  ]

  return (
    <div className="flex flex-col divide-y divide-border">
      {items.map((item, index) => (
        <div key={item} className="flex items-center gap-3 py-3">
          <span
            className={cn(
              "grid size-6 place-items-center rounded-full border",
              index < 4
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            )}
          >
            {index < 4 ? <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} /> : index + 1}
          </span>
          <span className="text-sm">{item}</span>
        </div>
      ))}
    </div>
  )
}

function SkillRequirementControl({
  skill,
  requirement,
  onChange,
}: {
  skill: SkillKey
  requirement: ProjectSkillRequirement
  onChange: (nextRequirement: Partial<ProjectSkillRequirement>) => void
}) {
  const totalCount = getRequirementTotal(requirement)

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <SkillIcon skill={skill} />
          <div className="min-w-0">
            <p className="font-medium">{skillLabels[skill]}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {skillDescriptions[skill]}
            </p>
          </div>
        </div>
        <Badge variant={totalCount > 0 ? "secondary" : "outline"} className="shrink-0">
          {totalCount} total
        </Badge>
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        <SkillLevelBar requirement={requirement} />
        {skillRequirementLevels.map((level) => {
          const field = getRequirementLevelField(level)
          const value = requirement[field]

          return (
            <SkillRequirementLevelRow
              key={field}
              skill={skill}
              level={level}
              value={value}
              onDecrease={() => onChange({ [field]: value - 1 })}
              onIncrease={() => onChange({ [field]: value + 1 })}
            />
          )
        })}
      </div>
    </div>
  )
}

function SkillRequirementLevelRow({
  skill,
  level,
  value,
  onDecrease,
  onIncrease,
}: {
  skill: SkillKey
  level: SkillRequirementLevel
  value: number
  onDecrease: () => void
  onIncrease: () => void
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-[7rem_1fr_auto] sm:items-center">
      <div>
        <p className="text-sm font-medium">Level {level}</p>
        <p className="text-xs text-muted-foreground">{skillLevelLabels[level]}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Engineers with at least L{level} {skillLabels[skill]} capability.
      </p>
      <div className="flex items-center gap-2 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={onDecrease}
          disabled={value === 0}
          aria-label={`Decrease ${skillLabels[skill]} level ${level} engineer count`}
        >
          -
        </Button>
        <span className="grid min-w-12 place-items-center rounded-2xl bg-background px-2 py-1.5 text-sm font-medium ring-1 ring-border">
          {value}x
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={onIncrease}
          aria-label={`Increase ${skillLabels[skill]} level ${level} engineer count`}
        >
          +
        </Button>
      </div>
    </div>
  )
}

function RoleCard({ role }: { role: RoleRequirement }) {
  return (
    <div className="rounded-2xl bg-muted p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{role.role_name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{role.reasoning}</p>
        </div>
        <Badge variant="outline">
          {role.count} {role.count === 1 ? "person" : "people"}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {skillKeys
          .filter((skill) => role.required_skills[skill] > 0)
          .map((skill) => (
            <Badge key={skill} variant="secondary">
              {skillLabels[skill]} L{role.required_skills[skill]}
            </Badge>
          ))}
      </div>
    </div>
  )
}

function SkillIcon({ skill }: { skill: SkillKey }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground">
      <HugeiconsIcon icon={skillIconMap[skill]} strokeWidth={2} />
    </span>
  )
}

function SkillLevelBar({ requirement }: { requirement: ProjectSkillRequirement }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {skillRequirementLevels.map((level) => {
        const value = requirement[getRequirementLevelField(level)]

        return (
        <span
          key={level}
          className={cn(
            "h-2 rounded-full",
            value > 0 ? "bg-primary" : "bg-muted"
          )}
        />
        )
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
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function Field({
  label,
  description,
  required,
  children,
}: {
  label: string
  description?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-muted-foreground"> *</span>}
      </span>
      {children}
      {description && (
        <span className="text-xs text-muted-foreground">{description}</span>
      )}
    </label>
  )
}

function SummaryCard({
  title,
  onEdit,
  children,
}: {
  title: string
  onEdit: () => void
  children: ReactNode
}) {
  return (
    <section className="rounded-3xl border border-border p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <Button type="button" variant="outline" size="xs" onClick={onEdit}>
          Edit
        </Button>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function normalizeProjectSkillRequirement(
  requirement: ProjectSkillRequirement
): ProjectSkillRequirement {
  return {
    level_1: normalizeRequirementCount(requirement.level_1),
    level_2: normalizeRequirementCount(requirement.level_2),
    level_3: normalizeRequirementCount(requirement.level_3),
  }
}

function cloneProjectSkillRequirements(
  requirements: ProjectSkillRequirements
): ProjectSkillRequirements {
  return skillKeys.reduce<ProjectSkillRequirements>((nextRequirements, skill) => {
    nextRequirements[skill] = normalizeProjectSkillRequirement(requirements[skill])
    return nextRequirements
  }, {} as ProjectSkillRequirements)
}

function countRequiredSkills(skills: ProjectSkillRequirements) {
  return skillKeys.filter((skill) => getRequirementTotal(skills[skill]) > 0).length
}

function formatRequirementBadge(
  skill: SkillKey,
  requirement: ProjectSkillRequirement
) {
  const parts = skillRequirementLevels
    .map((level) => {
      const count = requirement[getRequirementLevelField(level)]
      return count > 0 ? `${count}x L${level}` : null
    })
    .filter(Boolean)

  if (parts.length === 0) {
    return `${skillLabels[skill]} 0x`
  }

  return `${skillLabels[skill]} ${parts.join(", ")}`
}

function normalizeRequirementCount(value: number) {
  return Math.max(0, Math.round(value))
}

function getRequirementLevelField(
  level: SkillRequirementLevel
): SkillRequirementLevelField {
  return `level_${level}`
}

function getRequirementTotal(requirement: ProjectSkillRequirement) {
  return (
    requirement.level_1 +
    requirement.level_2 +
    requirement.level_3
  )
}

function getProjectMedia(websiteUrl: string) {
  const domain = normalizeDomain(websiteUrl)

  if (!domain) {
    return {
      domain: "",
      iconUrl: "",
      posterUrl: "",
    }
  }

  return {
    domain,
    iconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    posterUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
  }
}

function getProjectWebsite(project: Project) {
  const posterMatch = project.poster_url.match(/\/https:\/\/([^/]+)$/)
  if (posterMatch?.[1]) {
    return posterMatch[1]
  }

  try {
    const iconUrl = new URL(project.icon_url)
    const domain = iconUrl.searchParams.get("domain")

    if (domain) {
      return domain
    }
  } catch {
    return ""
  }

  return ""
}

function normalizeDomain(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return ""
  }

  try {
    const url = new URL(
      trimmedValue.startsWith("http") ? trimmedValue : `https://${trimmedValue}`
    )

    return url.hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function normalizeGithubUrl(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return ""
  }

  if (/^[\w.-]+\/[\w.-]+$/.test(trimmedValue)) {
    return `https://github.com/${trimmedValue}`
  }

  try {
    const url = new URL(
      trimmedValue.startsWith("http") ? trimmedValue : `https://${trimmedValue}`
    )

    if (url.hostname !== "github.com") {
      return ""
    }

    return `https://github.com${url.pathname.replace(/\/$/, "")}`
  } catch {
    return ""
  }
}

function normalizeGithubUrls(values: string[]) {
  const normalizedValues: string[] = []
  const seenValues = new Set<string>()

  values.forEach((value) => {
    const normalizedValue = normalizeGithubUrl(value)

    if (!normalizedValue || seenValues.has(normalizedValue)) {
      return
    }

    normalizedValues.push(normalizedValue)
    seenValues.add(normalizedValue)
  })

  return normalizedValues
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatPhase(phase: ProjectPhase) {
  return phase
    .split(" ")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ")
}
