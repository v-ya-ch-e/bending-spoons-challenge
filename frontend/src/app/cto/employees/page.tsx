import { EmployeesScreen } from "@/components/employees/employees-screen"
import { loadEmployeesInitialData } from "@/lib/server/db-api"

export default async function EmployeesPage() {
  const initialData = await loadEmployeesInitialData()

  return <EmployeesScreen initialData={initialData} />
}
