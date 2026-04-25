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

export type Employee = {
  id: number
  name: string
  role: string
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

const dbApiBasePath = process.env.NEXT_PUBLIC_DB_API_BASE_URL ?? "/db-api"
const listCacheTtlMs = 5 * 60 * 1000

type ListCacheEntry<T> = {
  data: T
  fetchedAt: number
  promise?: Promise<T>
}

let employeesCache: ListCacheEntry<Employee[]> | null = null
let projectsCache: ListCacheEntry<Project[]> | null = null

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

  return response.json() as Promise<T>
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
