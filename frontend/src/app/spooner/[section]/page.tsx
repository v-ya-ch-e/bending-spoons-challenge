import { notFound } from "next/navigation"

import { roleWorkspaces } from "@/data/mock-navigation"
import { WorkspacePlaceholder } from "@/components/workspace-placeholder"

type SpoonerSectionPageProps = {
  params: {
    section: string
  }
}

export default async function SpoonerSectionPage({
  params,
}: SpoonerSectionPageProps) {
  const { section } = params
  const item = roleWorkspaces.spooner.navItems.find(
    (navItem) => navItem.value === section
  )

  if (!item) {
    notFound()
  }

  return <WorkspacePlaceholder role="spooner" title={item.label} />
}
