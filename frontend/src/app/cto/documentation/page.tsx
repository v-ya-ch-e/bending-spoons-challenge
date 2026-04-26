import { DocumentationScreen } from "@/components/documentation/documentation-screen"
import { loadDocumentationInitialData } from "@/lib/server/db-api"

export default async function CtoDocumentationPage() {
  const initialData = await loadDocumentationInitialData()

  return <DocumentationScreen initialData={initialData} />
}
