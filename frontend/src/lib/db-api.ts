export type SkillKey =
  | "android"
  | "ios"
  | "web"
  | "backend"
  | "infrastructure"
  | "ai"

export type Skills = Record<SkillKey, number>

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
  required_skills: Skills
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

export class DbApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "DbApiError"
  }
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
    throw new DbApiError(
      `DB API request failed with status ${response.status}`,
      response.status
    )
  }

  return response.json() as Promise<T>
}

export function listEmployees() {
  return fetchDbApi<Employee[]>("/employees?limit=500")
}

export function listProjects() {
  return fetchDbApi<Project[]>("/projects?limit=500")
}

export function createProject(project: ProjectCreateInput) {
  return fetchDbApi<Project>("/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(project),
  })
}

export function updateProject(projectId: number, project: ProjectUpdateInput) {
  return fetchDbApi<Project>(`/projects/${projectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(project),
  })
}

export function createEmployee(employee: EmployeeCreateInput) {
  return fetchDbApi<Employee>("/employees", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(employee),
  })
}

export function updateEmployee(employeeId: number, employee: EmployeeUpdateInput) {
  return fetchDbApi<Employee>(`/employees/${employeeId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(employee),
  })
}
