import { CtoMoveRequestsScreen } from "@/components/move-requests/cto-move-requests-screen"
import { listServerMoveRequests } from "@/lib/server/db-api"

export default async function MoveRequestsPage() {
  const initialRequests = await listServerMoveRequests().catch(() => null)

  return <CtoMoveRequestsScreen initialRequests={initialRequests} />
}
