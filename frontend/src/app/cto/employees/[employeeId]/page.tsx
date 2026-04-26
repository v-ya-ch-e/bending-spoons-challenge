import { EmployeesScreen } from "@/components/employees/employees-screen"
import { loadEmployeesInitialData } from "@/lib/server/db-api"

type EmployeeDetailPageProps = {
  params: Promise<{
    employeeId: string
  }>
}

export default async function EmployeeDetailPage({
  params,
}: EmployeeDetailPageProps) {
  const [{ employeeId }, initialData] = await Promise.all([
    params,
    loadEmployeesInitialData(),
  ])

  return <EmployeesScreen selectedEmployeeId={employeeId} initialData={initialData} />
}
