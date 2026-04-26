import { CtoOverviewScreen } from "@/components/overview/cto-overview-screen"
import { loadOverviewInitialData } from "@/lib/server/db-api"

export default async function CtoOverviewPage() {
  const initialData = await loadOverviewInitialData()

  return <CtoOverviewScreen initialData={initialData} />
}
