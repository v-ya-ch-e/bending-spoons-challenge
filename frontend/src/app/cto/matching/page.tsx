import { MatchingScreen } from "@/components/matching/matching-screen"
import { loadMatchingInitialData } from "@/lib/server/db-api"

export default async function MatchingPage() {
  const initialData = await loadMatchingInitialData()

  return <MatchingScreen initialData={initialData} />
}
