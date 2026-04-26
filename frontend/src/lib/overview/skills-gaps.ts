import type { Employee, Project, SkillKey } from "@/lib/db-api"

export const skillKeys: SkillKey[] = [
  "android",
  "ios",
  "web",
  "backend",
  "infrastructure",
  "ai",
]

export const skillTitles: Record<SkillKey, string> = {
  android: "Android",
  ios: "iOS",
  web: "Web",
  backend: "Backend",
  infrastructure: "Infrastructure",
  ai: "AI",
}

export const skillRoleTitles: Record<SkillKey, string> = {
  android: "Android engineer",
  ios: "iOS engineer",
  web: "Web engineer",
  backend: "Backend engineer",
  infrastructure: "Infrastructure engineer",
  ai: "AI engineer",
}

export type SkillGap = {
  l1: number
  l2: number
  l3: number
  total: number
}

export type ProjectSkillGap = {
  skill: SkillKey
  gap: SkillGap
}

export type ProjectGap = {
  project: Project
  gaps: ProjectSkillGap[]
  totalGap: number
}

export type CompanyGap = {
  skill: SkillKey
  gap: SkillGap
}

function getEmployeesForProject(project: Project, employees: Employee[]) {
  const idSet = new Set(project.current_team_member_ids)
  return employees.filter((employee) => idSet.has(employee.id))
}

export function computeProjectSkillGap(
  project: Project,
  employees: Employee[],
  skill: SkillKey
): SkillGap {
  const team = getEmployeesForProject(project, employees)
  const req = project.required_skills[skill]

  const haveL3 = team.filter((employee) => employee.skills[skill] >= 3).length
  const haveL2 = team.filter((employee) => employee.skills[skill] >= 2).length
  const haveL1 = team.filter((employee) => employee.skills[skill] >= 1).length

  const gap3 = Math.max(0, req.level_3 - haveL3)
  const gap2 = Math.max(0, req.level_2 - Math.max(0, haveL2 - req.level_3))
  const gap1 = Math.max(
    0,
    req.level_1 - Math.max(0, haveL1 - req.level_3 - req.level_2)
  )

  return {
    l1: gap1,
    l2: gap2,
    l3: gap3,
    total: gap1 + gap2 + gap3,
  }
}

export function computeProjectGaps(
  project: Project,
  employees: Employee[]
): ProjectGap {
  const gaps: ProjectSkillGap[] = skillKeys
    .map((skill) => ({
      skill,
      gap: computeProjectSkillGap(project, employees, skill),
    }))
    .filter((entry) => entry.gap.total > 0)

  return {
    project,
    gaps,
    totalGap: gaps.reduce((total, entry) => total + entry.gap.total, 0),
  }
}

export function computeCompanyGaps(
  projects: Project[],
  employees: Employee[]
): CompanyGap[] {
  return skillKeys.map((skill) => {
    const aggregate = projects.reduce<SkillGap>(
      (sum, project) => {
        const gap = computeProjectSkillGap(project, employees, skill)
        return {
          l1: sum.l1 + gap.l1,
          l2: sum.l2 + gap.l2,
          l3: sum.l3 + gap.l3,
          total: sum.total + gap.total,
        }
      },
      { l1: 0, l2: 0, l3: 0, total: 0 }
    )

    return { skill, gap: aggregate }
  })
}

export function countSkillExperts(
  employees: Employee[],
  skill: SkillKey
): { count: number; experts: Employee[] } {
  const experts = employees.filter((employee) => employee.skills[skill] >= 3)
  return { count: experts.length, experts }
}

export type HireSuggestion = {
  skill: SkillKey
  score: number
  level: "Senior" | "Mid" | "Junior"
  slotsClosed: number
  gap: SkillGap
}

export function rankHireNext(
  companyGaps: CompanyGap[],
  limit = 4
): HireSuggestion[] {
  return companyGaps
    .map(({ skill, gap }) => {
      const score = gap.l3 * 6 + gap.l2 * 3 + gap.l1 * 1
      const level: HireSuggestion["level"] =
        gap.l3 > 0 ? "Senior" : gap.l2 > 0 ? "Mid" : "Junior"

      return {
        skill,
        score,
        level,
        slotsClosed: gap.total,
        gap,
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}
