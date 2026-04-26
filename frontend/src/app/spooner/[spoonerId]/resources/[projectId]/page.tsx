import { notFound } from "next/navigation"

import { EmployeeProjectResourcesScreen } from "@/components/spooner/employee-project-resources-screen"

type EmployeeProjectResourcesPageProps = {
  params: Promise<{
    spoonerId: string
    projectId: string
  }>
}

export default async function EmployeeProjectResourcesPage({
  params,
}: EmployeeProjectResourcesPageProps) {
  const { spoonerId, projectId } = await params
  const employeeId = parsePositiveInt(spoonerId)
  const parsedProjectId = parsePositiveInt(projectId)

  if (employeeId === null || parsedProjectId === null) {
    notFound()
  }

  return (
    <EmployeeProjectResourcesScreen
      employeeId={employeeId}
      projectId={parsedProjectId}
    />
  )
}

function parsePositiveInt(value: string) {
  if (!/^[1-9]\d*$/.test(value)) {
    return null
  }

  return Number(value)
}
