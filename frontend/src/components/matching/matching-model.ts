import type {
  Employee,
  ImpactLevel,
  MatchingCandidate,
  MatchingRecommendation,
  MatchingRecommendationMove,
  MatchingRun,
  MoveRequest,
  MoveRequestStatus,
  Project,
  ProjectSkillRequirement,
  SkillKey,
} from "@/lib/db-api"

export type MatchingLifecycleState = "draft" | "active" | "ready" | "completed"

export type MatchingTab = MatchingLifecycleState | "all"

export type MatchingRunBundle = {
  run: MatchingRun
  recommendations: MatchingRecommendation[]
  candidates: MatchingCandidate[]
}

export type RequirementCoverageRow = {
  skill: SkillKey
  requiredSlots: number
  currentCovered: number
  afterCovered: number
  status: "covered" | "partially_covered" | "missing" | "not_required"
  coveringEmployees: Employee[]
}

export type ProposedMovement = {
  id: string
  employee: Employee | null
  sourceProject: Project | null
  targetProject: Project
  action: "assign" | "move" | "add_assignment"
  expectedRole: string
  currentProjectImpact: ImpactLevel
  reason: string
  request: MoveRequest | null
  requestStatus: MoveRequestStatus | "not_sent"
  requirementsCovered: string[]
}

export type AffectedCompanyImpact = {
  project: Project | null
  lostEmployees: Employee[]
  risk: ImpactLevel
  beforeHeadcount: number
  afterHeadcount: number
  requiredHeadcount: number
}

export type EmployeeTransitionImpact = {
  employee: Employee | null
  movement: ProposedMovement
  transitionEffort: string
  handoffNeeds: string
  status: MoveRequestStatus | "not_sent"
}

export type MovePlan = {
  id: string
  origin: "recommendation" | "move_requests"
  title: string
  targetProject: Project
  summary: string
  lifecycle: MatchingLifecycleState
  highestImpact: ImpactLevel
  coveragePercent: number
  pendingApprovalCount: number
  run: MatchingRun | null
  recommendation: MatchingRecommendation | null
  candidate: MatchingCandidate | null
  requests: MoveRequest[]
  movements: ProposedMovement[]
  requirementCoverage: RequirementCoverageRow[]
  affectedCompanies: AffectedCompanyImpact[]
  employeeImpacts: EmployeeTransitionImpact[]
}

export type MatchingCreateFlowMetadata = {
  planName?: string
  goal?: string
  targetProjectId?: number
  targetProjectName?: string
  policyId?: number
  policyName?: string
  policyPreset?: string
  candidatePool?: string
  moveTiming?: string
  impactTolerance?: string
  avoidBreakingMinimums?: boolean
  excludeOpenMoveRequests?: boolean
  preferLowerTransitionEffort?: boolean
  preferFewerMoves?: boolean
  maxMoves?: number
  createdAt?: string
}

export const skillLabels: Record<SkillKey, string> = {
  android: "Android",
  ios: "iOS",
  web: "Web",
  backend: "Backend",
  infrastructure: "Infra",
  ai: "AI",
}

export const skillKeys = [
  "android",
  "ios",
  "web",
  "backend",
  "infrastructure",
  "ai",
] as const satisfies SkillKey[]

const impactRank: Record<ImpactLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
}

export function buildMovePlans({
  employees,
  projects,
  moveRequests,
  runBundles,
}: {
  employees: Employee[]
  projects: Project[]
  moveRequests: MoveRequest[]
  runBundles: MatchingRunBundle[]
}) {
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]))
  const projectById = new Map(projects.map((project) => [project.id, project]))
  const usedRequestIds = new Set<number>()
  const recommendationPlans: MovePlan[] = []

  for (const bundle of runBundles) {
    const targetProject = bundle.run.target_project_id
      ? projectById.get(bundle.run.target_project_id)
      : undefined

    if (!targetProject) {
      continue
    }

    for (const recommendation of bundle.recommendations) {
      const candidate =
        bundle.candidates.find(
          (item) => item.candidate_plan_id === recommendation.candidate_plan_id
        ) ?? null
      const plan = buildPlanFromRecommendation({
        bundle,
        recommendation,
        candidate,
        targetProject,
        moveRequests,
        employeeById,
        projectById,
      })

      for (const request of plan.requests) {
        usedRequestIds.add(request.id)
      }

      recommendationPlans.push(plan)
    }
  }

  const requestPlans = buildPlansFromUnmatchedRequests({
    moveRequests: moveRequests.filter((request) => !usedRequestIds.has(request.id)),
    employeeById,
    projectById,
  })

  return [...recommendationPlans, ...requestPlans].sort(sortPlans)
}

export function formatLifecycle(state: MatchingLifecycleState) {
  if (state === "ready") return "Ready"
  return state.charAt(0).toUpperCase() + state.slice(1)
}

export function formatRequestStatus(status: MoveRequestStatus | "not_sent") {
  const labels: Record<MoveRequestStatus | "not_sent", string> = {
    not_sent: "Not sent",
    pending: "Pending",
    accepted: "Accepted",
    rejected: "Rejected",
    clarification_requested: "Clarification requested",
  }

  return labels[status]
}

export function formatImpact(impact: ImpactLevel) {
  return impact.charAt(0).toUpperCase() + impact.slice(1)
}

export function formatRequirement(requirement: ProjectSkillRequirement) {
  return ([1, 2, 3] as const)
    .map((level) => {
      const count = requirement[`level_${level}`]
      return count > 0 ? `L${level} x ${count}` : null
    })
    .filter((part): part is string => Boolean(part))
    .join(", ")
}

export function getRequirementTotal(requirement: ProjectSkillRequirement) {
  return requirement.level_1 + requirement.level_2 + requirement.level_3
}

function buildPlanFromRecommendation({
  bundle,
  recommendation,
  candidate,
  targetProject,
  moveRequests,
  employeeById,
  projectById,
}: {
  bundle: MatchingRunBundle
  recommendation: MatchingRecommendation
  candidate: MatchingCandidate | null
  targetProject: Project
  moveRequests: MoveRequest[]
  employeeById: Map<number, Employee>
  projectById: Map<number, Project>
}): MovePlan {
  const movements = recommendation.suggested_moves.map((move, index) =>
    buildMovement({
      move,
      index,
      targetProject,
      matchingRequest: findMatchingRequest(moveRequests, move),
      employeeById,
      projectById,
    })
  )
  const requests = uniqueRequests(
    movements.map((movement) => movement.request).filter(Boolean) as MoveRequest[]
  )
  const metadata = getCreateFlowMetadata(bundle.run)

  return completePlan({
    id: `run-${bundle.run.id}-${recommendation.candidate_plan_id}`,
    origin: "recommendation",
    title: metadata?.planName || `Staff ${targetProject.project_name}`,
    summary:
      metadata?.goal ||
      recommendation.summary ||
      bundle.run.summary ||
      "Generated matching plan.",
    targetProject,
    run: bundle.run,
    recommendation,
    candidate,
    requests,
    movements,
    employeeById,
  })
}

export function getCreateFlowMetadata(
  run: MatchingRun | null
): MatchingCreateFlowMetadata | null {
  const metadata = run?.input_snapshot?.matching_create_flow

  if (!metadata || typeof metadata !== "object") {
    return null
  }

  return metadata as MatchingCreateFlowMetadata
}

function buildPlansFromUnmatchedRequests({
  moveRequests,
  employeeById,
  projectById,
}: {
  moveRequests: MoveRequest[]
  employeeById: Map<number, Employee>
  projectById: Map<number, Project>
}) {
  const requestsByTarget = new Map<number, MoveRequest[]>()

  for (const request of moveRequests) {
    const targetProject = projectById.get(request.to_project_id)
    if (!targetProject) {
      continue
    }

    requestsByTarget.set(request.to_project_id, [
      ...(requestsByTarget.get(request.to_project_id) ?? []),
      request,
    ])
  }

  return [...requestsByTarget.entries()].flatMap(([targetProjectId, requests]) => {
    const targetProject = projectById.get(targetProjectId)
    if (!targetProject) {
      return []
    }

    const movements = requests.map((request, index) =>
      buildMovement({
        move: {
          employee_id: request.employee_id,
          from_project_id: request.from_project_id,
          to_project_id: request.to_project_id,
          action: "move",
          suggested_role: request.expected_role,
          current_project_impact: request.current_project_impact,
          reason: request.reason,
          move_request_reason: request.reason,
        },
        index,
        targetProject,
        matchingRequest: request,
        employeeById,
        projectById,
      })
    )

    return completePlan({
      id: `requests-${targetProject.id}`,
      origin: "move_requests",
      title: `${targetProject.project_name} move request`,
      summary: "Move requests created through the staffing workflow.",
      targetProject,
      run: null,
      recommendation: null,
      candidate: null,
      requests,
      movements,
      employeeById,
    })
  })
}

function buildMovement({
  move,
  index,
  targetProject,
  matchingRequest,
  employeeById,
  projectById,
}: {
  move: MatchingRecommendationMove
  index: number
  targetProject: Project
  matchingRequest: MoveRequest | null
  employeeById: Map<number, Employee>
  projectById: Map<number, Project>
}): ProposedMovement {
  const employee = employeeById.get(move.employee_id) ?? null
  const sourceProject = move.from_project_id
    ? projectById.get(move.from_project_id) ?? null
    : null

  return {
    id: `${move.employee_id}-${move.to_project_id}-${index}`,
    employee,
    sourceProject,
    targetProject,
    action: move.action,
    expectedRole: move.suggested_role || move.expected_role || employee?.role || "Staff member",
    currentProjectImpact: move.current_project_impact,
    reason: move.move_request_reason || move.reason || "Matches target staffing requirements.",
    request: matchingRequest,
    requestStatus: matchingRequest?.status ?? "not_sent",
    requirementsCovered: employee
      ? describeCoveredRequirements(employee, targetProject)
      : ["Coverage unavailable"],
  }
}

function completePlan({
  id,
  origin,
  title,
  summary,
  targetProject,
  run,
  recommendation,
  candidate,
  requests,
  movements,
  employeeById,
}: {
  id: string
  origin: MovePlan["origin"]
  title: string
  summary: string
  targetProject: Project
  run: MatchingRun | null
  recommendation: MatchingRecommendation | null
  candidate: MatchingCandidate | null
  requests: MoveRequest[]
  movements: ProposedMovement[]
  employeeById: Map<number, Employee>
}): MovePlan {
  const lifecycle = getLifecycle({ requests, movements })
  const requirementCoverage = buildRequirementCoverage({
    targetProject,
    movements,
    employeeById,
  })
  const affectedCompanies = buildAffectedCompanies(targetProject, movements)
  const employeeImpacts = movements.map((movement) => ({
    employee: movement.employee,
    movement,
    status: movement.requestStatus,
    transitionEffort: getTransitionEffort(movement.currentProjectImpact),
    handoffNeeds: getHandoffNeeds(movement),
  }))

  return {
    id,
    origin,
    title,
    targetProject,
    summary,
    lifecycle,
    highestImpact: getHighestImpact(movements),
    coveragePercent: getCoveragePercent(requirementCoverage),
    pendingApprovalCount: requests.filter(
      (request) =>
        request.status === "pending" || request.status === "clarification_requested"
    ).length,
    run,
    recommendation,
    candidate,
    requests,
    movements,
    requirementCoverage,
    affectedCompanies,
    employeeImpacts,
  }
}

function getLifecycle({
  requests,
  movements,
}: {
  requests: MoveRequest[]
  movements: ProposedMovement[]
}): MatchingLifecycleState {
  if (requests.length === 0) {
    return "draft"
  }

  const accepted = requests.every((request) => request.status === "accepted")
  if (!accepted) {
    return "active"
  }

  return movements.every(isMovementApplied) ? "completed" : "ready"
}

function isMovementApplied(movement: ProposedMovement) {
  if (!movement.employee) {
    return false
  }

  const currentProjectIds = movement.employee.current_project_ids
  const hasTarget = currentProjectIds.includes(movement.targetProject.id)
  const stillInSource =
    movement.sourceProject && currentProjectIds.includes(movement.sourceProject.id)

  if (movement.action === "add_assignment") {
    return hasTarget
  }

  return hasTarget && !stillInSource
}

function buildRequirementCoverage({
  targetProject,
  movements,
  employeeById,
}: {
  targetProject: Project
  movements: ProposedMovement[]
  employeeById: Map<number, Employee>
}): RequirementCoverageRow[] {
  const currentEmployeeIds = new Set(targetProject.current_team_member_ids)
  const afterEmployeeIds = new Set(currentEmployeeIds)

  for (const movement of movements) {
    if (movement.employee) {
      afterEmployeeIds.add(movement.employee.id)
    }
  }

  return skillKeys.map((skill) => {
    const requirement = targetProject.required_skills[skill]
    const currentEmployees = [...currentEmployeeIds]
      .map((employeeId) => employeeById.get(employeeId))
      .filter((employee): employee is Employee => Boolean(employee))
    const afterEmployees = [...afterEmployeeIds]
      .map((employeeId) => employeeById.get(employeeId))
      .filter((employee): employee is Employee => Boolean(employee))
    const requiredSlots = getRequirementTotal(requirement)
    const currentCovered = countCoveredSlots(skill, requirement, currentEmployees)
    const afterCovered = countCoveredSlots(skill, requirement, afterEmployees)

    return {
      skill,
      requiredSlots,
      currentCovered,
      afterCovered,
      status: getCoverageStatus(requiredSlots, afterCovered),
      coveringEmployees: afterEmployees.filter((employee) =>
        canCoverAnyRequirement(employee, skill, requirement)
      ),
    }
  })
}

function countCoveredSlots(
  skill: SkillKey,
  requirement: ProjectSkillRequirement,
  employees: Employee[]
) {
  const availableLevels = employees
    .map((employee) => employee.skills[skill])
    .filter((level) => level > 0)
    .sort((left, right) => right - left)
  let covered = 0

  for (const requiredLevel of [3, 2, 1] as const) {
    let remaining = requirement[`level_${requiredLevel}`]

    while (remaining > 0) {
      const employeeIndex = availableLevels.findIndex((level) => level >= requiredLevel)
      if (employeeIndex === -1) {
        break
      }

      availableLevels.splice(employeeIndex, 1)
      covered += 1
      remaining -= 1
    }
  }

  return covered
}

function getCoverageStatus(requiredSlots: number, coveredSlots: number) {
  if (requiredSlots === 0) return "not_required"
  if (coveredSlots >= requiredSlots) return "covered"
  if (coveredSlots > 0) return "partially_covered"
  return "missing"
}

function canCoverAnyRequirement(
  employee: Employee,
  skill: SkillKey,
  requirement: ProjectSkillRequirement
) {
  return ([1, 2, 3] as const).some(
    (level) => requirement[`level_${level}`] > 0 && employee.skills[skill] >= level
  )
}

function describeCoveredRequirements(employee: Employee, targetProject: Project) {
  const requirements = skillKeys
    .flatMap((skill) => {
      const requirement = targetProject.required_skills[skill]
      return ([3, 2, 1] as const)
        .filter(
          (level) => requirement[`level_${level}`] > 0 && employee.skills[skill] >= level
        )
        .slice(0, 1)
        .map((level) => `${skillLabels[skill]} L${level}`)
    })
    .slice(0, 3)

  return requirements.length > 0 ? requirements : ["General team capacity"]
}

function buildAffectedCompanies(
  targetProject: Project,
  movements: ProposedMovement[]
) {
  const sourceProjectIds = new Set(
    movements
      .map((movement) => movement.sourceProject?.id)
      .filter((projectId): projectId is number => Boolean(projectId))
  )

  return [...sourceProjectIds].map((projectId) => {
    const project =
      movements.find((movement) => movement.sourceProject?.id === projectId)
        ?.sourceProject ?? null
    const lostMovements = movements.filter(
      (movement) => movement.sourceProject?.id === projectId
    )
    const beforeHeadcount = project?.current_team_member_ids.length ?? 0
    const afterHeadcount = Math.max(beforeHeadcount - lostMovements.length, 0)

    return {
      project,
      lostEmployees: lostMovements
        .map((movement) => movement.employee)
        .filter((employee): employee is Employee => Boolean(employee)),
      risk: getHighestImpact(lostMovements),
      beforeHeadcount,
      afterHeadcount,
      requiredHeadcount: project?.required_people_amount ?? targetProject.required_people_amount,
    }
  })
}

function getCoveragePercent(rows: RequirementCoverageRow[]) {
  const required = rows.reduce((sum, row) => sum + row.requiredSlots, 0)
  if (required === 0) {
    return 100
  }

  const covered = rows.reduce(
    (sum, row) => sum + Math.min(row.afterCovered, row.requiredSlots),
    0
  )

  return Math.round((covered / required) * 100)
}

function getHighestImpact(movements: Array<{ currentProjectImpact: ImpactLevel }>) {
  return movements.reduce<ImpactLevel>(
    (highest, movement) =>
      impactRank[movement.currentProjectImpact] > impactRank[highest]
        ? movement.currentProjectImpact
        : highest,
    "low"
  )
}

function getTransitionEffort(impact: ImpactLevel) {
  if (impact === "high") return "5 days"
  if (impact === "medium") return "3 days"
  return "1 day"
}

function getHandoffNeeds(movement: ProposedMovement) {
  if (movement.currentProjectImpact === "high") {
    return "Delivery owner review, open work handoff, and runbook update"
  }

  if (movement.currentProjectImpact === "medium") {
    return "Open work handoff and onboarding context"
  }

  return movement.sourceProject ? "Light context handoff" : "Onboarding context only"
}

function findMatchingRequest(
  moveRequests: MoveRequest[],
  move: MatchingRecommendationMove
) {
  return (
    moveRequests.find(
      (request) =>
        request.employee_id === move.employee_id &&
        request.to_project_id === move.to_project_id &&
        (request.from_project_id ?? null) === (move.from_project_id ?? null)
    ) ?? null
  )
}

function uniqueRequests(requests: MoveRequest[]) {
  const seen = new Set<number>()
  return requests.filter((request) => {
    if (seen.has(request.id)) {
      return false
    }

    seen.add(request.id)
    return true
  })
}

function sortPlans(left: MovePlan, right: MovePlan) {
  const stateOrder: Record<MatchingLifecycleState, number> = {
    draft: 0,
    active: 1,
    ready: 2,
    completed: 3,
  }

  return (
    stateOrder[left.lifecycle] - stateOrder[right.lifecycle] ||
    right.movements.length - left.movements.length ||
    left.targetProject.project_name.localeCompare(right.targetProject.project_name)
  )
}
