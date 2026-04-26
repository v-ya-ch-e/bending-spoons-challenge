import type {
  ProjectDocumentation,
  ImpactLevel,
  MatchingRunUseCase,
  MoveRequest,
  MoveRequestApprovalActor,
  MoveRequestApprovalStatus,
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

export type DocumentationChatMessage = {
  role: "user" | "assistant"
  content: string
}

export type DocumentationChatInput = {
  message: string
  history?: DocumentationChatMessage[]
  mode?: "ask" | "edit"
}

export type DocumentationChatResponse = {
  answer: string
  updated_content_markdown: string | null
}

export type MatchingRunRequest = {
  requested_by?: string | null
  policy_id?: number | null
  policy_name?: string | null
}

export type MatchingSuggestionMove = {
  employee_id: number
  from_project_id: number | null
  to_project_id: number
  action: "assign" | "move" | "add_assignment"
  suggested_role: string
  current_project_impact: ImpactLevel
  reason: string
  move_request_reason: string
}

export type MatchingSuggestion = {
  suggestion_id: string
  candidate_plan_id: string
  rank: number
  score: number | null
  title: string
  rationale: string
  tradeoffs: string[]
  risks: string[]
  moves: MatchingSuggestionMove[]
  impact: {
    target_project_id: number
    target_headcount_gap: number
    target_skill_gap: Partial<Record<SkillKey, number>>
    source_project_impacts: Array<{
      project_id: number
      impact: ImpactLevel
    }>
  }
}

export type MatchingHiringSuggestion = {
  candidate_plan_id: string | null
  project_id: number
  role_title: string
  count: number
  required_skills: Skills
  rationale: string
  urgency: ImpactLevel
  suggested_assignment: string | null
}

export type MatchingRunResponse = {
  run_id: number
  use_case: MatchingRunUseCase
  status: "pending" | "running" | "completed" | "failed"
  target_project_id: number | null
  summary: {
    headline: string
    selected_candidate_plan_id: string | null
    generated_candidate_count: number
    evaluated_candidate_count: number
    suggestion_count: number
    hiring_suggestion_count: number
  }
  suggestions: MatchingSuggestion[]
  hiring_suggestions: MatchingHiringSuggestion[]
  diagnostics: {
    policy_id: number
    policy_name: string
    event_count: number
    warnings: string[]
  }
}

type StreamEventHandler = (event: string, data: Record<string, unknown>) => void

const backendApiBasePath =
  process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL ?? "/api"
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

export function runProjectMatching(projectId: number, input: MatchingRunRequest = {}) {
  const payload = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null)
  )

  return fetchBackendApi<MatchingRunResponse>(
    `/projects/${projectId}/matching:run`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : "{}",
    }
  )
}

export function refreshProjectDocumentation(projectId: number) {
  return fetchBackendApi<ProjectDocumentation>(
    `/projects/${projectId}/documentation:refresh`,
    {
      method: "POST",
    }
  )
}

export function chatWithProjectDocumentation(
  projectId: number,
  input: DocumentationChatInput
) {
  return fetchBackendApi<DocumentationChatResponse>(
    `/projects/${projectId}/documentation:chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: input.message,
        history: input.history ?? [],
        mode: input.mode ?? "ask",
      }),
    }
  )
}

export function streamProjectDocumentationRefresh(
  projectId: number,
  onEvent: StreamEventHandler
) {
  return fetchBackendEventStream(
    `/projects/${projectId}/documentation:refresh-stream`,
    { method: "POST" },
    onEvent
  )
}

export function streamProjectDocumentationChat(
  projectId: number,
  input: DocumentationChatInput,
  onEvent: StreamEventHandler
) {
  return fetchBackendEventStream(
    `/projects/${projectId}/documentation:chat-stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: input.message,
        history: input.history ?? [],
        mode: input.mode ?? "ask",
      }),
    },
    onEvent
  )
}

export function approveMoveRequest(
  requestId: number,
  approver: MoveRequestApprovalActor,
  approvalStatus: MoveRequestApprovalStatus
) {
  return fetchBackendApi<MoveRequest>(`/move-requests/${requestId}/approval`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      approver,
      approval_status: approvalStatus,
    }),
  })
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

async function fetchBackendEventStream(
  path: string,
  init: RequestInit,
  onEvent: StreamEventHandler
) {
  const response = await fetch(`${backendApiBasePath}${path}`, {
    ...init,
    headers: {
      Accept: "text/event-stream",
      ...init.headers,
    },
  })

  if (!response.ok) {
    const { detail, bodyText } = await readBackendError(response)
    throw new BackendApiError(
      detail || `Backend API stream ${path} failed (${response.status})`,
      response.status,
      detail || bodyText
    )
  }

  if (!response.body) {
    throw new BackendApiError("Backend API stream did not return a response body.", 0)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""
    for (const rawEvent of events) {
      emitServerSentEvent(rawEvent, onEvent)
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) {
    emitServerSentEvent(buffer, onEvent)
  }
}

function emitServerSentEvent(rawEvent: string, onEvent: StreamEventHandler) {
  const lines = rawEvent.split("\n")
  const eventLine = lines.find((line) => line.startsWith("event:"))
  const dataLines = lines.filter((line) => line.startsWith("data:"))
  const event = eventLine?.slice("event:".length).trim() || "message"
  const dataText = dataLines
    .map((line) => line.slice("data:".length).trimStart())
    .join("\n")
  if (!dataText) {
    onEvent(event, {})
    return
  }

  try {
    onEvent(event, JSON.parse(dataText) as Record<string, unknown>)
  } catch {
    onEvent(event, { value: dataText })
  }
}
