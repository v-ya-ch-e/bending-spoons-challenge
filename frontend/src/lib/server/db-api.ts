import "server-only"

import type {
  Employee,
  MatchingCandidate,
  MatchingPolicy,
  MatchingRecommendation,
  MatchingRun,
  MoveRequest,
  Project,
  ProjectDocumentation,
} from "@/lib/db-api"
import {
  buildMovePlans,
  type MatchingRunBundle,
} from "@/components/matching/matching-model"

export type AppShellInitialData = {
  employees: Employee[]
  projectCount: number
  employeeCount: number
  matchingPlanCount: number
}

export type DocumentationInitialData = {
  projects: Project[]
  documentation: ProjectDocumentation[]
}

export type ProjectsInitialData = {
  employees: Employee[]
  projects: Project[]
}

export type EmployeesInitialData = {
  employees: Employee[]
  projects: Project[]
}

export type MatchingInitialData = {
  employees: Employee[]
  projects: Project[]
  moveRequests: MoveRequest[]
  policies: MatchingPolicy[]
  runBundles: MatchingRunBundle[]
}

export type SpoonerPickerInitialData = {
  employees: Employee[]
}

const DEFAULT_DB_API_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://dev.doubleu.team/db-api"
    : "http://127.0.0.1:8001"

function getDbApiBaseUrl() {
  return (process.env.DB_API_BASE_URL?.trim() || DEFAULT_DB_API_BASE_URL).replace(
    /\/$/,
    ""
  )
}

async function fetchDbApi<T>(path: string): Promise<T> {
  const response = await fetch(`${getDbApiBaseUrl()}${path}`, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`DB API ${path} failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

function normalizeProject(project: Project): Project {
  return {
    ...project,
    current_team_member_ids: project.current_team_member_ids ?? [],
    current_team_members: project.current_team_members ?? [],
    github_repositories: project.github_repositories ?? [],
  }
}

export function listServerEmployees() {
  return fetchDbApi<Employee[]>("/employees?limit=500")
}

export async function listServerProjects() {
  const projects = await fetchDbApi<Project[]>("/projects?limit=500")
  return projects.map(normalizeProject)
}

export function listServerProjectDocumentation() {
  return fetchDbApi<ProjectDocumentation[]>("/project-documentation?limit=500")
}

export function listServerMoveRequests() {
  return fetchDbApi<MoveRequest[]>("/move-requests?limit=500")
}

export function listServerMatchingPolicies() {
  return fetchDbApi<MatchingPolicy[]>("/policies?limit=500")
}

export function listServerMatchingRuns() {
  return fetchDbApi<MatchingRun[]>("/matching-runs?limit=500")
}

export function listServerMatchingCandidates(runId: number) {
  return fetchDbApi<MatchingCandidate[]>(
    `/matching-runs/${runId}/candidates?limit=500`
  )
}

export function listServerMatchingRecommendations(runId: number) {
  return fetchDbApi<MatchingRecommendation[]>(
    `/matching-runs/${runId}/recommendations?limit=500`
  )
}

async function loadMatchingPlanCount() {
  const initialData = await loadMatchingInitialData()

  if (!initialData) {
    return 0
  }

  return buildMovePlans(initialData).length
}

export async function loadAppShellInitialData(): Promise<AppShellInitialData | null> {
  const [employeesResult, projectsResult, matchingPlanCountResult] = await Promise.allSettled([
    listServerEmployees(),
    listServerProjects(),
    loadMatchingPlanCount(),
  ])
  const employees =
    employeesResult.status === "fulfilled" ? employeesResult.value : []
  const projects =
    projectsResult.status === "fulfilled" ? projectsResult.value : []
  const matchingPlanCount =
    matchingPlanCountResult.status === "fulfilled" ? matchingPlanCountResult.value : 0

  if (
    employeesResult.status === "rejected" &&
    projectsResult.status === "rejected" &&
    matchingPlanCountResult.status === "rejected"
  ) {
    return null
  }

  return {
    employees,
    projectCount: projects.length,
    employeeCount: employees.length,
    matchingPlanCount,
  }
}

export async function loadDocumentationInitialData(): Promise<DocumentationInitialData | null> {
  try {
    const [projects, documentation] = await Promise.all([
      listServerProjects(),
      listServerProjectDocumentation(),
    ])

    return { projects, documentation }
  } catch {
    return null
  }
}

export async function loadProjectsInitialData(): Promise<ProjectsInitialData | null> {
  try {
    const [employees, projects] = await Promise.all([
      listServerEmployees(),
      listServerProjects(),
    ])

    return { employees, projects }
  } catch {
    return null
  }
}

export async function loadEmployeesInitialData(): Promise<EmployeesInitialData | null> {
  try {
    const [employees, projects] = await Promise.all([
      listServerEmployees(),
      listServerProjects(),
    ])

    return { employees, projects }
  } catch {
    return null
  }
}

export async function loadSpoonerPickerInitialData(): Promise<SpoonerPickerInitialData | null> {
  try {
    return { employees: await listServerEmployees() }
  } catch {
    return null
  }
}

export async function loadMatchingInitialData(): Promise<MatchingInitialData | null> {
  try {
    const [employees, projects, moveRequests, policies, matchingRuns] = await Promise.all([
      listServerEmployees(),
      listServerProjects(),
      listServerMoveRequests(),
      listServerMatchingPolicies(),
      listServerMatchingRuns(),
    ])
    const recentRuns = matchingRuns
      .filter((run) => run.use_case === "project_rebalance")
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      )
      .slice(0, 24)
    const runBundles = await Promise.all(
      recentRuns.map(async (run) => {
        const [recommendations, candidates] = await Promise.all([
          listServerMatchingRecommendations(run.id),
          listServerMatchingCandidates(run.id),
        ])

        return { run, recommendations, candidates }
      })
    )

    return {
      employees,
      projects,
      moveRequests,
      policies,
      runBundles,
    }
  } catch {
    return null
  }
}
