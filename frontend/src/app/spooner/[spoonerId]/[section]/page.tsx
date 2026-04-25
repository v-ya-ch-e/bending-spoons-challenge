import { notFound } from "next/navigation"

import { roleWorkspaces } from "@/data/mock-navigation"
import { SpoonerWorkspace } from "@/components/spooner/spooner-workspace"

type SpoonerSectionPageProps = {
  params: Promise<{
    spoonerId: string
    section: string
  }>
}

export default async function SpoonerSectionPage({
  params,
}: SpoonerSectionPageProps) {
  const { spoonerId, section } = await params
  const item = roleWorkspaces.spooner.navItems.find(
    (navItem) => navItem.value === section
  )

  const parsedSpoonerId = Number.parseInt(spoonerId, 10)

  if (!item || !Number.isFinite(parsedSpoonerId) || parsedSpoonerId <= 0) {
    notFound()
  }

  return (
    <SpoonerWorkspace spoonerId={parsedSpoonerId} sectionLabel={item.label} />
  )
}
