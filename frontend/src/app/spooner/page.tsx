import { SpoonerPickerScreen } from "@/components/spooner/spooner-picker-screen"
import { loadSpoonerPickerInitialData } from "@/lib/server/db-api"

export default async function SpoonerPickerPage() {
  const initialData = await loadSpoonerPickerInitialData()

  return <SpoonerPickerScreen initialData={initialData} />
}
