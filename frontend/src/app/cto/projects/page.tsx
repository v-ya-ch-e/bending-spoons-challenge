import { ProjectsScreen } from "@/components/projects/projects-screen"
import { loadProjectsInitialData } from "@/lib/server/db-api"

export default async function ProjectsPage() {
  const initialData = await loadProjectsInitialData()

  return <ProjectsScreen initialData={initialData} />
}
