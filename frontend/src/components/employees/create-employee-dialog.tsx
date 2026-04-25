"use client"

import { useMemo, useState } from "react"

import {
  createEmployee,
  DbApiError,
  updateEmployee,
  type Employee,
  type EmployeeCreateInput,
  type EmployeeUpdateInput,
  type Project,
  type SkillKey,
  type Skills,
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

type CreateEmployeeDialogProps = {
  open: boolean
  projects: Project[]
  employee?: Employee
  mode?: "create" | "edit"
  onOpenChange: (open: boolean) => void
  onCreated: (employee: Employee) => void
}

type StepId = "details" | "skills" | "assignment" | "summary"

type FormState = {
  name: string
  role: string
  interestsText: string
  skills: Skills
  currentProject: string
  preferencesText: string
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

const levelLabels = ["None", "Basic", "Strong", "Expert"]

const levelSegmentColors = [
  "bg-muted",
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
]

const steps: Array<{
  id: StepId
  label: string
  description: string
}> = [
  {
    id: "details",
    label: "Personal details",
    description: "Basic profile information.",
  },
  {
    id: "skills",
    label: "Skills",
    description: "Capability levels across the staffing taxonomy.",
  },
  {
    id: "assignment",
    label: "Assignment",
    description: "Current project and project preferences.",
  },
  {
    id: "summary",
    label: "Summary",
    description: "Review before adding the employee.",
  },
]

const emptySkills: Skills = {
  android: 0,
  ios: 0,
  web: 0,
  backend: 0,
  infrastructure: 0,
  ai: 0,
}

function getInitialFormState(employee?: Employee): FormState {
  if (!employee) {
    return {
      name: "",
      role: "",
      interestsText: "",
      skills: { ...emptySkills },
      currentProject: "",
      preferencesText: "",
    }
  }

  return {
    name: employee.name,
    role: employee.role,
    interestsText: employee.interests.join(", "),
    skills: { ...employee.skills },
    currentProject: employee.current_project ?? "",
    preferencesText: employee.preferences.join(", "),
  }
}

export function CreateEmployeeDialog({
  open,
  projects,
  employee,
  mode = "create",
  onOpenChange,
  onCreated,
}: CreateEmployeeDialogProps) {
  const isEditMode = mode === "edit" && employee
  const [stepIndex, setStepIndex] = useState(0)
  const [formState, setFormState] = useState<FormState>(() =>
    getInitialFormState(employee)
  )
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentStep = steps[stepIndex]
  const isFirstStep = stepIndex === 0
  const isSummaryStep = currentStep.id === "summary"

  const interests = useMemo(
    () => parseTokens(formState.interestsText),
    [formState.interestsText]
  )
  const preferences = useMemo(
    () => parseTokens(formState.preferencesText),
    [formState.preferencesText]
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

  function updateSkill(skill: SkillKey, nextLevel: number) {
    const clampedLevel = Math.min(3, Math.max(0, nextLevel))
    updateFormState((current) => ({
      skills: {
        ...current.skills,
        [skill]: clampedLevel,
      },
    }))
  }

  function validateStep(step: StepId) {
    if (step === "details") {
      if (!formState.name.trim()) {
        return "Enter the employee's full name."
      }

      if (!formState.role.trim()) {
        return "Enter the employee's role."
      }
    }

    return null
  }

  function handleNext() {
    const nextValidationError = validateStep(currentStep.id)

    if (nextValidationError) {
      setValidationError(nextValidationError)
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

  function addPreference(projectName: string) {
    const nextPreferences = new Set(preferences)
    nextPreferences.add(projectName)
    updateFormState({ preferencesText: Array.from(nextPreferences).join(", ") })
  }

  async function handleSave() {
    const nextValidationError = validateStep("details")

    if (nextValidationError) {
      setValidationError(nextValidationError)
      setStepIndex(0)
      return
    }

    const payload: EmployeeCreateInput | EmployeeUpdateInput = {
      name: formState.name.trim(),
      role: formState.role.trim(),
      current_project: formState.currentProject || null,
      skills: formState.skills,
      preferences,
      interests,
    }

    try {
      setIsSubmitting(true)
      setSubmitError(null)
      const savedEmployee =
        isEditMode && employee
          ? await updateEmployee(employee.id, payload)
          : await createEmployee(payload as EmployeeCreateInput)
      onCreated(savedEmployee)
    } catch (error) {
      if (error instanceof DbApiError && error.status === 409) {
        setSubmitError("An employee with this name already exists.")
      } else {
        setSubmitError(
          error instanceof Error
            ? error.message
            : `Unable to ${isEditMode ? "save" : "create"} the employee.`
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(44rem,calc(100svh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="text-lg">
            {isEditMode ? "Edit employee" : "Add new employee"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditMode
              ? "Edit an internal employee using the current backend employee schema."
              : "Create a new internal employee using the current backend employee schema."}
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
              <div className="mx-auto max-w-2xl">
                {validationError && (
                  <Alert variant="destructive" className="mb-5">
                    <AlertTitle>Check this step</AlertTitle>
                    <AlertDescription>{validationError}</AlertDescription>
                  </Alert>
                )}

                {submitError && (
                  <Alert variant="destructive" className="mb-5">
                    <AlertTitle>
                      Could not {isEditMode ? "save" : "create"} employee
                    </AlertTitle>
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                )}

                {currentStep.id === "details" && (
                  <PersonalDetailsStep
                    formState={formState}
                    onChange={updateFormState}
                  />
                )}

                {currentStep.id === "skills" && (
                  <SkillsStep skills={formState.skills} onSkillChange={updateSkill} />
                )}

                {currentStep.id === "assignment" && (
                  <AssignmentStep
                    formState={formState}
                    projects={projects}
                    preferences={preferences}
                    onAddPreference={addPreference}
                    onChange={updateFormState}
                  />
                )}

                {currentStep.id === "summary" && (
                  <SummaryStep
                    formState={formState}
                    interests={interests}
                    preferences={preferences}
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
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <div className="flex flex-1 justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isFirstStep || isSubmitting}
            >
              Back
            </Button>
            {isSummaryStep ? (
              <Button type="button" onClick={handleSave} disabled={isSubmitting}>
                {isSubmitting
                  ? isEditMode
                    ? "Saving..."
                    : "Creating..."
                  : isEditMode
                    ? "Save changes"
                    : "Create employee"}
              </Button>
            ) : (
              <Button type="button" onClick={handleNext}>
                Next
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
                  : "border-border text-muted-foreground"
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{step.label}</span>
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

function PersonalDetailsStep({
  formState,
  onChange,
}: {
  formState: FormState
  onChange: (partialState: Partial<FormState>) => void
}) {
  return (
    <section className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-6 duration-200">
      <StepHeading
        title="Personal details"
        description="Enter the core profile information for this internal employee."
      />
      <div className="flex flex-col gap-4">
        <Field label="Full name" required>
          <Input
            value={formState.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Enter full name"
            aria-label="Full name"
          />
        </Field>
        <Field label="Role" required>
          <Input
            value={formState.role}
            onChange={(event) => onChange({ role: event.target.value })}
            placeholder="Backend engineer, Product designer..."
            aria-label="Role"
          />
        </Field>
        <Field
          label="Interests"
          description="Optional. Separate interests with commas or new lines."
        >
          <Textarea
            value={formState.interestsText}
            onChange={(event) => onChange({ interestsText: event.target.value })}
            placeholder="platform reliability, internal tools, AI workflows"
            aria-label="Interests"
            className="min-h-28"
          />
        </Field>
      </div>
    </section>
  )
}

function SkillsStep({
  skills,
  onSkillChange,
}: {
  skills: Skills
  onSkillChange: (skill: SkillKey, nextLevel: number) => void
}) {
  return (
    <section className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-6 duration-200">
      <StepHeading
        title="Skills"
        description="Set practical capability levels. Level 0 means no relevant experience; level 3 means the employee can lead and review work."
      />
      <div className="flex flex-col divide-y divide-border rounded-3xl border border-border">
        {(Object.keys(skillLabels) as SkillKey[]).map((skill) => (
          <SkillControl
            key={skill}
            skill={skill}
            level={skills[skill]}
            onChange={(nextLevel) => onSkillChange(skill, nextLevel)}
          />
        ))}
      </div>
    </section>
  )
}

function SkillControl({
  skill,
  level,
  onChange,
}: {
  skill: SkillKey
  level: number
  onChange: (nextLevel: number) => void
}) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-[10rem_1fr_auto] sm:items-center">
      <div>
        <p className="font-medium">{skillLabels[skill]}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {skillDescriptions[skill]}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onChange(index + 1)}
              className={cn("h-3 rounded-full transition-colors", getSegmentColor(level, index))}
              aria-label={`Set ${skillLabels[skill]} to level ${index + 1}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{levelLabels[level]}</span>
          <span>Level {level}/3</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => onChange(level - 1)}
          disabled={level === 0}
          aria-label={`Decrease ${skillLabels[skill]} level`}
        >
          -
        </Button>
        <span className="grid size-8 place-items-center rounded-2xl bg-muted text-sm font-medium">
          {level}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => onChange(level + 1)}
          disabled={level === 3}
          aria-label={`Increase ${skillLabels[skill]} level`}
        >
          +
        </Button>
      </div>
    </div>
  )
}

function AssignmentStep({
  formState,
  projects,
  preferences,
  onAddPreference,
  onChange,
}: {
  formState: FormState
  projects: Project[]
  preferences: string[]
  onAddPreference: (projectName: string) => void
  onChange: (partialState: Partial<FormState>) => void
}) {
  return (
    <section className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-6 duration-200">
      <StepHeading
        title="Assignment"
        description="Assign a current project and capture projects the employee would prefer to work on."
      />
      <div className="flex flex-col gap-4">
        <Field label="Current project">
          <Select
            value={formState.currentProject || "none"}
            onValueChange={(value) =>
              onChange({ currentProject: value === "none" ? "" : value })
            }
          >
            <SelectTrigger aria-label="Current project" className="w-full">
              <SelectValue placeholder="Select current project" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="none">Unassigned</SelectItem>
                {projects.map((project) => (
                  <SelectItem
                    key={project.id}
                    value={project.project_name}
                    textValue={project.project_name}
                  >
                    <ProjectSelectOption project={project} />
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Preferences"
          description="Optional. Use project names, separated with commas or new lines."
        >
          <Textarea
            value={formState.preferencesText}
            onChange={(event) => onChange({ preferencesText: event.target.value })}
            placeholder="Atlas Staffing, Growth Platform"
            aria-label="Preferences"
            className="min-h-24"
          />
        </Field>
        {projects.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Add from current projects
            </p>
            <div className="flex flex-wrap gap-2">
              {projects.slice(0, 8).map((project) => (
                <Button
                  key={project.id}
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => onAddPreference(project.project_name)}
                  disabled={preferences.includes(project.project_name)}
                >
                  {project.project_name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function SummaryStep({
  formState,
  interests,
  preferences,
  onEditStep,
}: {
  formState: FormState
  interests: string[]
  preferences: string[]
  onEditStep: (stepIndex: number) => void
}) {
  return (
    <section className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-6 duration-200">
      <StepHeading
        title="Summary"
        description="Review the information before adding the employee."
      />
      <SummaryCard title="Personal details" onEdit={() => onEditStep(0)}>
        <SummaryRow label="Full name" value={formState.name || "Not set"} />
        <SummaryRow label="Role" value={formState.role || "Not set"} />
        <SummaryTokenRow label="Interests" items={interests} emptyLabel="No interests" />
      </SummaryCard>
      <SummaryCard title="Skills" onEdit={() => onEditStep(1)}>
        <div className="flex flex-col gap-2">
          {(Object.keys(skillLabels) as SkillKey[]).map((skill) => (
            <div
              key={skill}
              className="grid grid-cols-[8rem_1fr_6rem] items-center gap-3"
            >
              <span className="text-sm text-muted-foreground">
                {skillLabels[skill]}
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <span
                    key={index}
                    className={cn("h-2 rounded-full", getSegmentColor(formState.skills[skill], index))}
                  />
                ))}
              </div>
              <div className="flex justify-end">
                <Badge variant="outline">{levelLabels[formState.skills[skill]]}</Badge>
              </div>
            </div>
          ))}
        </div>
      </SummaryCard>
      <SummaryCard title="Assignment" onEdit={() => onEditStep(2)}>
        <SummaryRow
          label="Current project"
          value={formState.currentProject || "Unassigned"}
        />
        <SummaryTokenRow
          label="Preferences"
          items={preferences}
          emptyLabel="No preferences"
        />
      </SummaryCard>
    </section>
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
  children: React.ReactNode
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
  children: React.ReactNode
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

function SummaryTokenRow({
  label,
  items,
  emptyLabel,
}: {
  label: string
  items: string[]
  emptyLabel: string
}) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
      <span className="text-muted-foreground">{label}</span>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Badge key={item} variant="secondary">
              {item}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground">{emptyLabel}</span>
      )}
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

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function parseTokens(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function getSegmentColor(level: number, index: number) {
  if (index >= level) {
    return "bg-muted hover:bg-muted-foreground/20"
  }

  return levelSegmentColors[level]
}
