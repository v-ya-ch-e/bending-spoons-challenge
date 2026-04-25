import { EmployeesScreen } from "@/components/employees/employees-screen"

type EmployeeDetailPageProps = {
  params: {
    employeeId: string
  }
}

export default async function EmployeeDetailPage({
  params,
}: EmployeeDetailPageProps) {
  const { employeeId } = params

  return <EmployeesScreen selectedEmployeeId={employeeId} />
}
