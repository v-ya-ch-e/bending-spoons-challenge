export type SkillKey =
  | "android"
  | "ios"
  | "web"
  | "backend"
  | "infrastructure"
  | "ai"

export type Skills = Record<SkillKey, number>

export type ProjectSkillRequirement = {
  level_1: number
  level_2: number
  level_3: number
}

export type ProjectSkillRequirements = Record<SkillKey, ProjectSkillRequirement>

export type ProjectPhase = "new acquisition" | "growth" | "maintenance"

export type ImpactLevel = "low" | "medium" | "high"

export type Employee = {
  id: number
  name: string
  role: string
  github_username: string | null
  current_project: string | null
  current_project_ids: number[]
  current_project_names: string[]
  skills: Skills
  preferences: string[]
  interests: string[]
}

export type EmployeeCreateInput = {
  name: string
  role: string
  github_username: string | null
  current_project: string | null
  skills: Skills
  preferences: string[]
  interests: string[]
}

export type EmployeeUpdateInput = Partial<EmployeeCreateInput>

export type Project = {
  id: number
  project_name: string
  project_description: string
  project_phase: ProjectPhase
  icon_url: string
  poster_url: string
  current_team_member_ids: number[]
  current_team_members: string[]
  required_people_amount: number
  required_skills: ProjectSkillRequirements
  github_repositories: string[]
}

export type ProjectCreateInput = Omit<
  Project,
  "id" | "current_team_members" | "current_team_member_ids"
> & {
  current_team_member_ids?: number[]
}

export type ProjectUpdateInput = Partial<ProjectCreateInput>

export type ProjectDocumentationStatus = "pending" | "running" | "ready" | "failed"

export type ProjectDocumentation = {
  id: number
  project_id: number
  project_name: string
  status: ProjectDocumentationStatus
  content_markdown: string
  source_repositories: string[]
  source_snapshot: Record<string, unknown> | null
  model_metadata: Record<string, unknown> | null
  last_error: string | null
  last_generated_at: string | null
  created_at: string
  updated_at: string
}

export type ProjectDocumentationUpdateInput = Partial<
  Pick<
    ProjectDocumentation,
    | "status"
    | "content_markdown"
    | "source_repositories"
    | "source_snapshot"
    | "model_metadata"
    | "last_error"
    | "last_generated_at"
  >
>

export function isMockProjectDocumentation(
  documentation?: ProjectDocumentation | null
) {
  const sourceSnapshot = documentation?.source_snapshot
  const modelMetadata = documentation?.model_metadata
  return (
    sourceSnapshot?.generated_from === "mock" ||
    modelMetadata?.source === "mock_documentation_seed"
  )
}

export type MoveRequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "clarification_requested"
  | "transition_started"
  | "completed"

export type MoveRequestApprovalStatus = "pending" | "approved" | "rejected"

export type MoveRequest = {
  id: number
  employee_id: number
  employee_name: string
  from_project_id: number | null
  from_project_name: string | null
  to_project_id: number
  to_project_name: string
  reason: string
  expected_role: string
  current_project_impact: ImpactLevel
  status: MoveRequestStatus
  cto_approval_status: MoveRequestApprovalStatus
  cto_approved_at: string | null
  employee_approval_status: MoveRequestApprovalStatus
  employee_approved_at: string | null
  created_at: string
  responded_at: string | null
}

export type TransitionInstructionType = "onboarding" | "offboarding"

export type TransitionInstructionStatus =
  | "pending"
  | "running"
  | "ready"
  | "failed"
  | "solved"

export type TransitionInstruction = {
  id: number
  move_request_id: number
  instruction_type: TransitionInstructionType
  status: TransitionInstructionStatus
  content_markdown: string
  input_snapshot: Record<string, unknown> | null
  source_documentation_id: number | null
  source_documentation_updated_at: string | null
  model_metadata: Record<string, unknown> | null
  last_error: string | null
  solved_at: string | null
  solved_by_employee_id: number | null
  employee_id: number
  employee_name: string
  from_project_id: number | null
  from_project_name: string | null
  to_project_id: number
  to_project_name: string
  created_at: string
  updated_at: string
}

export type MoveRequestUpdateInput = Partial<{
  employee_id: number
  from_project_id: number | null
  to_project_id: number
  reason: string
  expected_role: string
  current_project_impact: ImpactLevel
  status: MoveRequestStatus
}>

export type MatchingRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"

export type MatchingRunUseCase =
  | "portfolio_rebalance"
  | "project_rebalance"
  | "project_staffing"

export type MatchingRun = {
  id: number
  use_case: MatchingRunUseCase
  target_project_id: number | null
  status: MatchingRunStatus
  requested_by: string | null
  rule_config: Record<string, unknown>
  input_snapshot: Record<string, unknown> | null
  candidate_count: number
  recommendation_count: number
  hiring_recommendation_count: number
  selected_candidate_plan_id: string | null
  summary: string | null
  error_message: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export type MatchingPolicy = {
  id: number
  name: string
  description: string | null
  config: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
  activated_at: string | null
}

export type MatchingPolicyCreateInput = {
  name: string
  description?: string | null
  config: Record<string, unknown>
  is_active?: boolean
}

export type MatchingRunUpdateInput = Partial<{
  use_case: MatchingRunUseCase
  target_project_id: number | null
  status: MatchingRunStatus
  requested_by: string | null
  rule_config: Record<string, unknown>
  input_snapshot: Record<string, unknown> | null
  candidate_count: number
  recommendation_count: number
  hiring_recommendation_count: number
  selected_candidate_plan_id: string | null
  summary: string | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
}>

export type MatchingCandidateMove = {
  employee_id: number
  from_project_id: number | null
  to_project_id: number
  action: "assign" | "move" | "add_assignment"
  suggested_role: string
  current_project_impact: ImpactLevel
  hard_rule_reasons?: string[]
  reason?: string
}

export type MatchingCandidatePlanPayload = {
  summary?: string
  moves?: MatchingCandidateMove[]
  risks?: string[]
  project_coverage_after?: Record<
    string,
    {
      headcount_gap?: number
      skill_gap?: Partial<Record<SkillKey, number>>
      skill_gap_requirements?: Partial<
        Record<SkillKey, Partial<ProjectSkillRequirement>>
      >
      available_skills?: Partial<Record<SkillKey, number>>
      available_skill_counts?: Partial<
        Record<SkillKey, Partial<ProjectSkillRequirement>>
      >
      coverage_ratio?: number
    }
  >
}

export type MatchingCandidate = {
  id: number
  run_id: number
  candidate_plan_id: string
  strict_score: number | null
  hard_rule_summary: Record<string, unknown> | null
  plan_payload: MatchingCandidatePlanPayload
  rejected_reason: string | null
  created_at: string
}

export type MatchingRecommendationMove = MatchingCandidateMove & {
  reason?: string
  move_request_reason?: string
  expected_role?: string
}

export type MatchingRecommendation = {
  id: number
  run_id: number
  candidate_plan_id: string
  rank: number
  fit_score: number | null
  summary: string
  explanation: string | null
  risks: string[]
  ramp_up_estimate: string | null
  suggested_moves: MatchingRecommendationMove[]
  model_metadata: Record<string, unknown> | null
  created_at: string
}

export type MatchingHiringRecommendation = {
  id: number
  run_id: number
  candidate_plan_id: string | null
  project_id: number | null
  role_title: string
  count: number
  required_skills: Skills
  reason: string
  urgency: ImpactLevel
  suggested_assignment: string | null
  created_at: string
}

export type MatchingRunEventLevel = "debug" | "info" | "warning" | "error"

export type MatchingRunEventStage =
  | "request"
  | "snapshot"
  | "strict_rules"
  | "hiring_gap"
  | "llm_evaluation"
  | "persistence"
  | "action"

export type MatchingRunEvent = {
  id: number
  run_id: number
  level: MatchingRunEventLevel
  stage: MatchingRunEventStage
  event_type: string
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

const dbApiBasePath = process.env.NEXT_PUBLIC_DB_API_BASE_URL ?? "/db-api"
const listCacheTtlMs = 5 * 60 * 1000

type ListCacheEntry<T> = {
  data: T
  fetchedAt: number
  promise?: Promise<T>
}

let employeesCache: ListCacheEntry<Employee[]> | null = null
let projectsCache: ListCacheEntry<Project[]> | null = null
let matchingRunsCache: ListCacheEntry<MatchingRun[]> | null = null

export class DbApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown
  ) {
    super(message)
    this.name = "DbApiError"
  }
}

const skillKeys: SkillKey[] = [
  "android",
  "ios",
  "web",
  "backend",
  "infrastructure",
  "ai",
]

export function normalizeGithubUsername(value: string | null | undefined) {
  const trimmedValue = value?.trim().replace(/^@+/, "").trim() ?? ""
  return trimmedValue || null
}

export function getGithubProfileUrl(username: string) {
  return `https://github.com/${username}`
}

async function fetchDbApi<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${dbApiBasePath}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const detail = await readErrorDetail(response)
    throw new DbApiError(
      formatDbApiErrorMessage(response.status, detail),
      response.status,
      detail
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

async function readErrorDetail(response: Response) {
  try {
    const payload = await response.json()
    return payload?.detail ?? payload
  } catch {
    return null
  }
}

function formatDbApiErrorMessage(status: number, detail: unknown) {
  const formattedDetail = formatErrorDetail(detail)

  return formattedDetail
    ? `DB API request failed with status ${status}: ${formattedDetail}`
    : `DB API request failed with status ${status}`
}

function formatErrorDetail(detail: unknown): string | null {
  if (!detail) {
    return null
  }

  if (typeof detail === "string") {
    return detail
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (!item || typeof item !== "object") {
          return String(item)
        }

        const error = item as { loc?: unknown[]; msg?: unknown }
        const location = Array.isArray(error.loc) ? error.loc.join(".") : null
        const message = typeof error.msg === "string" ? error.msg : JSON.stringify(item)

        return location ? `${location}: ${message}` : message
      })
      .join("; ")
  }

  return JSON.stringify(detail)
}

function normalizeProjectSkillRequirements(
  requiredSkills: unknown
): ProjectSkillRequirements {
  const rawSkills =
    requiredSkills && typeof requiredSkills === "object"
      ? (requiredSkills as Record<string, unknown>)
      : {}

  return skillKeys.reduce<ProjectSkillRequirements>((nextSkills, skill) => {
    const rawRequirement = rawSkills[skill]

    if (rawRequirement && typeof rawRequirement === "object") {
      const requirement = rawRequirement as Partial<ProjectSkillRequirement>
      const legacyRequirement = rawRequirement as {
        count?: unknown
        minimum_level?: unknown
      }

      if (
        "level_1" in requirement ||
        "level_2" in requirement ||
        "level_3" in requirement
      ) {
        nextSkills[skill] = {
          level_1: Math.max(0, Math.round(Number(requirement.level_1 ?? 0))),
          level_2: Math.max(0, Math.round(Number(requirement.level_2 ?? 0))),
          level_3: Math.max(0, Math.round(Number(requirement.level_3 ?? 0))),
        }
        return nextSkills
      }

      const count = Math.max(0, Math.round(Number(legacyRequirement.count ?? 0)))
      const minimumLevel = Math.min(
        3,
        Math.max(0, Math.round(Number(legacyRequirement.minimum_level ?? 0)))
      )

      nextSkills[skill] = {
        level_1: count > 0 && minimumLevel === 1 ? count : 0,
        level_2: count > 0 && minimumLevel === 2 ? count : 0,
        level_3: count > 0 && minimumLevel === 3 ? count : 0,
      }
      return nextSkills
    }

    const level = Math.min(3, Math.max(0, Math.round(Number(rawRequirement ?? 0))))
    nextSkills[skill] = {
      level_1: level === 1 ? 1 : 0,
      level_2: level === 2 ? 1 : 0,
      level_3: level === 3 ? 1 : 0,
    }

    return nextSkills
  }, {} as ProjectSkillRequirements)
}

function normalizeProject(project: Project): Project {
  return {
    ...project,
    required_skills: normalizeProjectSkillRequirements(project.required_skills),
  }
}

function isCacheFresh<T>(cache: ListCacheEntry<T> | null) {
  return Boolean(cache && Date.now() - cache.fetchedAt < listCacheTtlMs)
}

function upsertById<T extends { id: number }>(items: T[] | undefined, nextItem: T) {
  if (!items) {
    return [nextItem]
  }

  const exists = items.some((item) => item.id === nextItem.id)

  return exists
    ? items.map((item) => (item.id === nextItem.id ? nextItem : item))
    : [...items, nextItem]
}

export function getCachedEmployees() {
  return isCacheFresh(employeesCache) ? employeesCache?.data : undefined
}

export function getCachedProjects() {
  return isCacheFresh(projectsCache) ? projectsCache?.data : undefined
}

export function getCachedMatchingRuns() {
  return isCacheFresh(matchingRunsCache) ? matchingRunsCache?.data : undefined
}

export async function listEmployees() {
  if (isCacheFresh(employeesCache)) {
    return employeesCache!.data
  }

  if (employeesCache?.promise) {
    return employeesCache.promise
  }

  const promise = fetchDbApi<Employee[]>("/employees?limit=500")
  employeesCache = {
    data: employeesCache?.data ?? [],
    fetchedAt: employeesCache?.fetchedAt ?? 0,
    promise,
  }

  try {
    const employees = await promise
    employeesCache = {
      data: employees,
      fetchedAt: Date.now(),
    }
    return employees
  } catch (error) {
    employeesCache =
      employeesCache.data.length > 0
        ? { data: employeesCache.data, fetchedAt: employeesCache.fetchedAt }
        : null
    throw error
  }
}

export async function listProjects() {
  if (isCacheFresh(projectsCache)) {
    return projectsCache!.data
  }

  if (projectsCache?.promise) {
    return projectsCache.promise
  }

  const promise = fetchDbApi<Project[]>("/projects?limit=500").then((projects) =>
    projects.map(normalizeProject)
  )
  projectsCache = {
    data: projectsCache?.data ?? [],
    fetchedAt: projectsCache?.fetchedAt ?? 0,
    promise,
  }

  try {
    const normalizedProjects = await promise
    projectsCache = {
      data: normalizedProjects,
      fetchedAt: Date.now(),
    }
    return normalizedProjects
  } catch (error) {
    projectsCache =
      projectsCache.data.length > 0
        ? { data: projectsCache.data, fetchedAt: projectsCache.fetchedAt }
        : null
    throw error
  }
}

export async function listMatchingRuns() {
  if (isCacheFresh(matchingRunsCache)) {
    return matchingRunsCache!.data
  }

  if (matchingRunsCache?.promise) {
    return matchingRunsCache.promise
  }

  const promise = fetchDbApi<MatchingRun[]>("/matching-runs?limit=500")
  matchingRunsCache = {
    data: matchingRunsCache?.data ?? [],
    fetchedAt: matchingRunsCache?.fetchedAt ?? 0,
    promise,
  }

  try {
    const matchingRuns = await promise
    matchingRunsCache = {
      data: matchingRuns,
      fetchedAt: Date.now(),
    }
    return matchingRuns
  } catch (error) {
    matchingRunsCache =
      matchingRunsCache.data.length > 0
        ? { data: matchingRunsCache.data, fetchedAt: matchingRunsCache.fetchedAt }
        : null
    throw error
  }
}

export async function createProject(project: ProjectCreateInput) {
  const savedProject = await fetchDbApi<Project>("/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(project),
  })
  const normalizedProject = normalizeProject(savedProject)
  projectsCache = {
    data: upsertById(projectsCache?.data, normalizedProject),
    fetchedAt: Date.now(),
  }
  return normalizedProject
}

export async function updateProject(projectId: number, project: ProjectUpdateInput) {
  const savedProject = await fetchDbApi<Project>(`/projects/${projectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(project),
  })
  const normalizedProject = normalizeProject(savedProject)
  projectsCache = {
    data: upsertById(projectsCache?.data, normalizedProject),
    fetchedAt: Date.now(),
  }
  return normalizedProject
}

export function listProjectDocumentation() {
  return fetchDbApi<ProjectDocumentation[]>("/project-documentation?limit=500")
}

export function getProjectDocumentationByProject(projectId: number) {
  return fetchDbApi<ProjectDocumentation>(`/projects/${projectId}/documentation`)
}

export function updateProjectDocumentationByProject(
  projectId: number,
  documentation: ProjectDocumentationUpdateInput
) {
  return fetchDbApi<ProjectDocumentation>(`/projects/${projectId}/documentation`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(documentation),
  })
}

export function listEmployeeTransitionInstructions(
  employeeId: number,
  instructionType?: TransitionInstructionType
) {
  const params = new URLSearchParams({ limit: "500" })
  if (instructionType) {
    params.set("instruction_type", instructionType)
  }

  return fetchDbApi<TransitionInstruction[]>(
    `/employees/${employeeId}/transition-instructions?${params.toString()}`
  )
}

export function markTransitionInstructionSolved(
  moveRequestId: number,
  instructionType: TransitionInstructionType,
  employeeId: number
) {
  return fetchDbApi<TransitionInstruction>(
    `/move-requests/${moveRequestId}/transition-instructions/${instructionType}:solve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        solved_by_employee_id: employeeId,
      }),
    }
  )
}

export function createEmployee(employee: EmployeeCreateInput) {
  return fetchDbApi<Employee>("/employees", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(employee),
  }).then((savedEmployee) => {
    employeesCache = {
      data: upsertById(employeesCache?.data, savedEmployee),
      fetchedAt: Date.now(),
    }
    projectsCache = null
    return savedEmployee
  })
}

export function updateEmployee(employeeId: number, employee: EmployeeUpdateInput) {
  return fetchDbApi<Employee>(`/employees/${employeeId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(employee),
  }).then((savedEmployee) => {
    employeesCache = {
      data: upsertById(employeesCache?.data, savedEmployee),
      fetchedAt: Date.now(),
    }
    projectsCache = null
    return savedEmployee
  })
}

export function listMoveRequests() {
  return fetchDbApi<MoveRequest[]>("/move-requests?limit=500")
}

export function updateMoveRequest(
  requestId: number,
  moveRequest: MoveRequestUpdateInput
) {
  return fetchDbApi<MoveRequest>(`/move-requests/${requestId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(moveRequest),
  })
}

export function deleteMoveRequest(requestId: number) {
  return fetchDbApi<void>(`/move-requests/${requestId}`, {
    method: "DELETE",
  })
}

export function listMatchingPolicies() {
  return fetchDbApi<MatchingPolicy[]>("/policies?limit=500")
}

export function getActiveMatchingPolicy() {
  return fetchDbApi<MatchingPolicy>("/policies/active")
}

export function createMatchingPolicy(policy: MatchingPolicyCreateInput) {
  return fetchDbApi<MatchingPolicy>("/policies", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(policy),
  })
}

export function getMatchingRun(runId: number) {
  return fetchDbApi<MatchingRun>(`/matching-runs/${runId}`)
}

export function updateMatchingRun(runId: number, run: MatchingRunUpdateInput) {
  return fetchDbApi<MatchingRun>(`/matching-runs/${runId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(run),
  })
}

export function deleteMatchingRun(runId: number) {
  return fetchDbApi<void>(`/matching-runs/${runId}`, {
    method: "DELETE",
  })
}

export function listMatchingCandidates(runId: number) {
  return fetchDbApi<MatchingCandidate[]>(
    `/matching-runs/${runId}/candidates?limit=500`
  )
}

export function listMatchingRecommendations(runId: number) {
  return fetchDbApi<MatchingRecommendation[]>(
    `/matching-runs/${runId}/recommendations?limit=500`
  )
}

export function listMatchingHiringRecommendations(runId: number) {
  return fetchDbApi<MatchingHiringRecommendation[]>(
    `/matching-runs/${runId}/hiring-recommendations?limit=500`
  )
}

export function listMatchingRunEvents(runId: number) {
  return fetchDbApi<MatchingRunEvent[]>(`/matching-runs/${runId}/events?limit=500`)
}

export function createMoveRequestsFromMatchingRecommendation(
  runId: number,
  candidatePlanId: string
) {
  return fetchDbApi<{ move_requests: MoveRequest[] }>(
    `/matching-runs/${runId}/recommendations/${encodeURIComponent(
      candidatePlanId
    )}/move-requests`,
    {
      method: "POST",
    }
  )
}
