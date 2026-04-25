import type {
  ProjectPhase,
  ProjectSkillRequirements,
  SkillKey,
  Skills,
} from "@/lib/db-api"

export type RoleRequirement = {
  role_name: string
  count: number
  required_skills: Skills
  reasoning: string
}

export type StaffingSuggestion = {
  roles: RoleRequirement[]
  required_skills: ProjectSkillRequirements
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
    readonly status: number,
    readonly detail?: string
  ) {
    super(message)
    this.name = "BackendApiError"
  }
}

async function fetchBackendApi<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const method = init?.method ?? "GET"
  let response: Response
  try {
    response = await fetch(`${backendApiBasePath}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown fetch error"
    console.error("Backend API network request failed", {
      method,
      path,
      requestBody: init?.body,
      error: errorMessage,
    })
    throw new BackendApiError(
      `Network error while calling backend endpoint ${method} ${path}: ${errorMessage}`,
      0,
      errorMessage
    )
  }

  if (!response.ok) {
    const { detail, bodyText } = await readBackendError(response)
    const statusLine = `Backend API ${method} ${path} failed (${response.status})`
    const errorMessage = detail ? `${statusLine}: ${detail}` : statusLine

    console.error("Backend API request failed", {
      method,
      path,
      status: response.status,
      statusText: response.statusText,
      requestBody: init?.body,
      responseBody: bodyText,
    })

    throw new BackendApiError(
      errorMessage,
      response.status,
      detail || bodyText
    )
  }

  return response.json() as Promise<T>
}

async function readBackendError(response: Response) {
  const bodyText = await response.text()
  if (!bodyText.trim()) {
    return { detail: "", bodyText: "" }
  }

  try {
    const payload = JSON.parse(bodyText) as { detail?: unknown }

    if (typeof payload.detail === "string") {
      return { detail: payload.detail, bodyText }
    }

    if (Array.isArray(payload.detail)) {
      const detail = payload.detail
        .map((entry) => formatDetailEntry(entry))
        .filter(Boolean)
        .join("; ")
      return { detail, bodyText }
    }

    if (payload.detail && typeof payload.detail === "object") {
      return { detail: JSON.stringify(payload.detail), bodyText }
    }
  } catch {
    return { detail: bodyText, bodyText }
  }

  return { detail: bodyText, bodyText }
}

function formatDetailEntry(entry: unknown): string {
  if (!entry || typeof entry !== "object") {
    return String(entry ?? "")
  }

  const typedEntry = entry as {
    msg?: unknown
    type?: unknown
    loc?: unknown
  }
  const message = typeof typedEntry.msg === "string" ? typedEntry.msg : ""
  const type = typeof typedEntry.type === "string" ? typedEntry.type : ""
  const location = Array.isArray(typedEntry.loc)
    ? typedEntry.loc.map((value) => String(value)).join(".")
    : ""

  return [message, type && `(${type})`, location && `at ${location}`]
    .filter(Boolean)
    .join(" ")
}

export function suggestProjectRequirements(input: SkillProfileSuggestInput) {
  const path =
    input.projectId === undefined
      ? "/skill-profile/suggest"
      : `/projects/${input.projectId}/skill-profile/suggest`
  const payload = {
    github_repo_url: input.github_repo_url ?? input.github_repo_urls[0],
    github_repo_urls: input.github_repo_urls,
    project_phase: input.project_phase,
    task_description: input.task_description,
  }

  return fetchBackendApi<StaffingSuggestion>(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).catch((error) => {
    if (input.projectId !== undefined || !(error instanceof BackendApiError)) {
      throw error
    }

    if (error.status !== 404) {
      throw error
    }

    return fetchBackendApi<StaffingSuggestion>("/projects/0/skill-profile/suggest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
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
