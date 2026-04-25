import { notFound } from "next/navigation"

import { roleWorkspaces } from "@/data/mock-navigation"
import { WorkspacePlaceholder } from "@/components/workspace-placeholder"

type CtoSectionPageProps = {
  params: {
    section: string
  }
}

export default async function CtoSectionPage({ params }: CtoSectionPageProps) {
  const { section } = params
  const item = roleWorkspaces.cto.navItems.find((navItem) => navItem.value === section)

  if (!item) {
    notFound()
  }

  return <WorkspacePlaceholder role="cto" title={item.label} />
}
