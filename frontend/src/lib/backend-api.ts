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
const backendSkillKeys: SkillKey[] = [
  "android",
  "ios",
  "web",
  "backend",
  "infrastructure",
  "ai",
]

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
  const payload = {
    project_id: input.projectId ?? 1,
    github_page: input.github_repo_url ?? input.github_repo_urls[0] ?? "",
    project_description: input.task_description?.trim() || "Project requirement extraction request.",
  }

  return fetchBackendApi<StaffingSuggestion | LegacySkillProfileResponse>("/skill-profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).then(normalizeSkillProfileResponse)
}

export function suggestProjectRequirementsFromRepoRoute(
  input: SkillProfileSuggestInput
) {
  return suggestProjectRequirements(input)
}

export const skillKeys = backendSkillKeys

type LegacySkillProfileResponse = {
  required_people_amount: number
  required_skills_per_person: Skills[]
}

function normalizeSkillProfileResponse(
  payload: StaffingSuggestion | LegacySkillProfileResponse
): StaffingSuggestion {
  if ("required_skills" in payload && "total_headcount" in payload) {
    return payload
  }

  const requiredSkills: ProjectSkillRequirements = {
    android: { level_1: 0, level_2: 0, level_3: 0 },
    ios: { level_1: 0, level_2: 0, level_3: 0 },
    web: { level_1: 0, level_2: 0, level_3: 0 },
    backend: { level_1: 0, level_2: 0, level_3: 0 },
    infrastructure: { level_1: 0, level_2: 0, level_3: 0 },
    ai: { level_1: 0, level_2: 0, level_3: 0 },
  }

  for (const personSkills of payload.required_skills_per_person) {
    for (const skill of backendSkillKeys) {
      const level = personSkills[skill]
      if (level === 1) requiredSkills[skill].level_1 += 1
      else if (level === 2) requiredSkills[skill].level_2 += 1
      else if (level === 3) requiredSkills[skill].level_3 += 1
    }
  }

  return {
    roles: [],
    required_skills: requiredSkills,
    total_headcount: payload.required_people_amount,
    summary: "Generated from backend skill profile analysis.",
  }
}
