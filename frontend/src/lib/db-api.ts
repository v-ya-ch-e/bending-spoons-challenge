export type SkillKey =
  | "android"
  | "ios"
  | "web"
  | "backend"
  | "infrastructure"
  | "ai"

export type Skills = Record<SkillKey, number>

export type Employee = {
  id: number
  name: string
  role: string
  current_project: string | null
  skills: Skills
  preferences: string[]
  interests: string[]
}

export type Project = {
  id: number
  project_name: string
  project_description: string
  project_phase: "new acquisition" | "growth" | "maintenance"
  current_team_members: string[]
  required_people_amount: number
  required_skills: Skills
  github_repositories: string[]
}

const dbApiBasePath = process.env.NEXT_PUBLIC_DB_API_BASE_URL ?? "/db-api"

async function fetchDbApi<T>(path: string): Promise<T> {
  const response = await fetch(`${dbApiBasePath}${path}`, {
    headers: {
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`DB API request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function listEmployees() {
  return fetchDbApi<Employee[]>("/employees?limit=500")
}

export function listProjects() {
  return fetchDbApi<Project[]>("/projects?limit=500")
}
