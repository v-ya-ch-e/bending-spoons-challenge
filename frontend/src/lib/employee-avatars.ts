import type { Employee } from "@/lib/db-api"

type EmployeeAvatarInput = Pick<Employee, "id" | "name"> | { name: string; id?: number }

const femaleFaceIds = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19] as const
const maleFaceIds = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] as const

const femaleFirstNames = new Set([
  "alessia",
  "arianna",
  "beatrice",
  "elena",
  "francesca",
  "giulia",
  "laura",
  "marta",
  "sofia",
])

const maleFirstNames = new Set([
  "alberto",
  "alessandro",
  "dario",
  "emanuele",
  "francesco",
  "giovanni",
  "lorenzo",
  "luca",
  "marco",
  "matteo",
  "nicola",
  "paolo",
  "riccardo",
])

/** Unisex / ambiguous first names: prefer explicit lists above; otherwise treat as female here. */
const defaultFemaleFirstNames = new Set(["andrea"])

const newEmployeeMaleAvatarStorageKey = (employeeId: number) =>
  `bsc:new-employee-male-avatar:${employeeId}`

let faceIdByEmployeeId: Map<number, number> | null = null
let lastAssignmentSignature: string | null = null

export function getEmployeeAvatarSrc(employee: EmployeeAvatarInput) {
  const normalizedName = employee.name.trim()
  const faceId = resolveEmployeeFaceId(employee, normalizedName)

  return `/faces/face${faceId}.jpg`
}

export function syncEmployeeAvatarFaceAssignments(
  employees: Array<Pick<Employee, "id" | "name">>
) {
  const signature = `${buildEmployeeListSignature(employees)}||${buildNewEmployeeMaleAvatarPreferenceSignature(
    employees
  )}`

  if (signature === lastAssignmentSignature && faceIdByEmployeeId) {
    return
  }

  lastAssignmentSignature = signature
  faceIdByEmployeeId = buildFaceAssignments(employees)
}

export function seedNewEmployeeMaleAvatar(employeeId: number) {
  if (typeof window === "undefined") {
    return
  }

  try {
    const nextFaceId = maleFaceIds[Math.floor(Math.random() * maleFaceIds.length)]!
    window.localStorage.setItem(newEmployeeMaleAvatarStorageKey(employeeId), String(nextFaceId))
  } catch {
    // Ignore storage failures (private mode / disabled storage).
  }
}

function resolveEmployeeFaceId(employee: EmployeeAvatarInput, normalizedName: string) {
  if (typeof employee.id === "number" && faceIdByEmployeeId?.has(employee.id)) {
    return faceIdByEmployeeId.get(employee.id)!
  }

  return fallbackFaceIdForNameOnly(normalizedName)
}

function fallbackFaceIdForNameOnly(normalizedName: string) {
  const faceIds =
    getEmployeeGender(normalizedName) === "female" ? femaleFaceIds : maleFaceIds
  return faceIds[hashString(normalizedName) % faceIds.length]
}

function buildFaceAssignments(employees: Array<Pick<Employee, "id" | "name">>) {
  const nextMap = new Map<number, number>()
  const sorted = [...employees].sort((left, right) =>
    normalizeEmployeeName(left.name).localeCompare(normalizeEmployeeName(right.name))
  )

  let previousGender: "female" | "male" | undefined
  let previousFemaleFaceId: number | undefined
  let previousMaleFaceId: number | undefined

  for (const employee of sorted) {
    const normalizedName = normalizeEmployeeName(employee.name)
    const gender = getAvatarGenderForAssignment(employee.id, normalizedName)
    const pool = gender === "female" ? femaleFaceIds : maleFaceIds

    const previousFaceId =
      previousGender === gender
        ? gender === "female"
          ? previousFemaleFaceId
          : previousMaleFaceId
        : undefined

    const faceId = pickFaceIdForEmployee(employee.id, normalizedName, pool, previousFaceId)

    nextMap.set(employee.id, faceId)

    if (gender === "female") {
      previousFemaleFaceId = faceId
    } else {
      previousMaleFaceId = faceId
    }

    previousGender = gender
  }

  return nextMap
}

function getAvatarGenderForAssignment(employeeId: number, normalizedName: string) {
  if (readNewEmployeeMaleAvatarFaceId(employeeId) !== null) {
    return "male"
  }

  return getEmployeeGender(normalizedName)
}

function readNewEmployeeMaleAvatarFaceId(employeeId: number) {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.localStorage.getItem(newEmployeeMaleAvatarStorageKey(employeeId))
    if (!raw) {
      return null
    }

    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

function pickFaceIdForEmployee(
  employeeId: number,
  normalizedName: string,
  pool: readonly number[],
  previousFaceId: number | undefined
) {
  const preferred =
    pool === maleFaceIds ? readNewEmployeeMaleAvatarFaceId(employeeId) : null

  const orderedBase = orderFaceIdsForEmployee(employeeId, normalizedName, pool)
  const ordered =
    preferred && pool.includes(preferred)
      ? [preferred, ...orderedBase.filter((faceId) => faceId !== preferred)]
      : orderedBase

  const nonAdjacent = ordered.find((faceId) => faceId !== previousFaceId)
  if (nonAdjacent !== undefined) {
    return nonAdjacent
  }

  return ordered[0] ?? pool[0]
}

function orderFaceIdsForEmployee(employeeId: number, normalizedName: string, pool: readonly number[]) {
  const rotated = rotateArray(pool, hashString(`${employeeId}:${normalizedName}`))
  return shuffleByHash(rotated, hashString(`${normalizedName}:${employeeId}`))
}

function rotateArray<T>(items: readonly T[], offset: number) {
  if (items.length === 0) {
    return []
  }

  const start = offset % items.length
  return [...items.slice(start), ...items.slice(0, start)]
}

function shuffleByHash<T>(items: readonly T[], seed: number) {
  const nextItems = [...items]

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const j = (seed + index * 2654435761) >>> 0
    const swapIndex = j % (index + 1)
    ;[nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]]
  }

  return nextItems
}

function normalizeEmployeeName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase()
}

function getEmployeeGender(name: string) {
  const firstName = name.split(/\s+/)[0]?.toLowerCase() ?? ""

  if (femaleFirstNames.has(firstName)) {
    return "female"
  }

  if (maleFirstNames.has(firstName)) {
    return "male"
  }

  if (defaultFemaleFirstNames.has(firstName)) {
    return "female"
  }

  if (firstName.endsWith("a")) {
    return "female"
  }

  if (firstName.endsWith("o")) {
    return "male"
  }

  return hashString(name) % 2 === 0 ? "male" : "female"
}

function hashString(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}

function buildEmployeeListSignature(employees: Array<Pick<Employee, "id" | "name">>) {
  return employees
    .map((employee) => `${employee.id}:${normalizeEmployeeName(employee.name)}`)
    .sort()
    .join("|")
}

function buildNewEmployeeMaleAvatarPreferenceSignature(
  employees: Array<Pick<Employee, "id" | "name">>
) {
  if (typeof window === "undefined") {
    return ""
  }

  try {
    return employees
      .map((employee) => {
        const faceId = window.localStorage.getItem(newEmployeeMaleAvatarStorageKey(employee.id))
        return faceId ? `${employee.id}:${faceId}` : ""
      })
      .filter(Boolean)
      .sort()
      .join("|")
  } catch {
    return ""
  }
}

const allFaceIdsOrdered = [...femaleFaceIds, ...maleFaceIds] as const

/**
 * Assigns face images for a small preview grid (e.g. CTO overview) so no image repeats
 * within the given list. Runs deterministically on the server (no client-only globals).
 */
export function buildDistinctOverviewPeopleAvatarSrcs(
  employees: Array<Pick<Employee, "id" | "name">>
): Map<number, string> {
  const used = new Set<number>()
  const srcByEmployeeId = new Map<number, string>()

  const sorted = [...employees].sort((left, right) =>
    normalizeEmployeeName(left.name).localeCompare(normalizeEmployeeName(right.name))
  )

  for (const employee of sorted) {
    const normalizedName = normalizeEmployeeName(employee.name)
    const gender = getAvatarGenderForAssignment(employee.id, normalizedName)
    const primaryPool = gender === "female" ? femaleFaceIds : maleFaceIds
    const secondaryPool = gender === "female" ? maleFaceIds : femaleFaceIds

    const orderedPrimary = orderFaceIdsForEmployee(employee.id, normalizedName, primaryPool)
    const orderedSecondary = orderFaceIdsForEmployee(employee.id, normalizedName, secondaryPool)
    const orderedAll = orderFaceIdsForEmployee(employee.id, normalizedName, allFaceIdsOrdered)

    const faceId =
      orderedPrimary.find((candidate) => !used.has(candidate)) ??
      orderedSecondary.find((candidate) => !used.has(candidate)) ??
      orderedAll.find((candidate) => !used.has(candidate)) ??
      orderedAll[0]!

    used.add(faceId)
    srcByEmployeeId.set(employee.id, `/faces/face${faceId}.jpg`)
  }

  return srcByEmployeeId
}
