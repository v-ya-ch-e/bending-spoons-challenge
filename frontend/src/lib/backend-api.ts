import type { ProjectPhase, SkillKey, Skills } from "@/lib/db-api"

export type RoleRequirement = {
  role_name: string
  count: number
  required_skills: Skills
  reasoning: string
}

export type StaffingSuggestion = {
  roles: RoleRequirement[]
  summary: string
  total_headcount: number
}

export type SkillProfileSuggestInput = {
  projectId?: number
  github_repo_url?: string
  github_repo_urls: string[]
  project_phase: ProjectPhase
  task_description?: string | null
}

const backendApiBasePath = "/api"

export class BackendApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "BackendApiError"
  }
}

async function fetchBackendApi<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${backendApiBasePath}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const errorMessage = await readBackendError(response)

    throw new BackendApiError(
      errorMessage || `Backend API request failed with status ${response.status}`,
      response.status
    )
  }

  return response.json() as Promise<T>
}

async function readBackendError(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: unknown }

    if (typeof payload.detail === "string") {
      return payload.detail
    }
  } catch {
    return ""
  }

  return ""
}

export function suggestProjectRequirements(input: SkillProfileSuggestInput) {
  const path =
    input.projectId === undefined
      ? "/skill-profile:suggest"
      : `/projects/${input.projectId}/skill-profile:suggest`

  return fetchBackendApi<StaffingSuggestion>(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      github_repo_url: input.github_repo_url ?? input.github_repo_urls[0],
      github_repo_urls: input.github_repo_urls,
      project_phase: input.project_phase,
      task_description: input.task_description,
    }),
  })
}

export function suggestProjectRequirementsFromRepoRoute(
  input: SkillProfileSuggestInput
) {
  return suggestProjectRequirements(input)
}

export const skillKeys: SkillKey[] = [
  "android",
  "ios",
  "web",
  "backend",
  "infrastructure",
  "ai",
]
