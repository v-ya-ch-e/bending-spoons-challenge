import { EmployeesScreen } from "@/components/employees/employees-screen"

type EmployeeDetailPageProps = {
  params: Promise<{
    employeeId: string
  }>
}

export default async function EmployeeDetailPage({
  params,
}: EmployeeDetailPageProps) {
  const { employeeId } = await params

  return <EmployeesScreen selectedEmployeeId={employeeId} />
}
