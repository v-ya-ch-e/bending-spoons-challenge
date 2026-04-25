import { notFound } from "next/navigation"

import { WorkspacePlaceholder } from "@/components/workspace-placeholder"
import { roleWorkspaces } from "@/data/mock-navigation"

type EmployeeSpoonerSectionPageProps = {
  params: Promise<{
    spoonerSlug: string
    section: string
  }>
}

export default async function EmployeeSpoonerSectionPage({
  params,
}: EmployeeSpoonerSectionPageProps) {
  const { spoonerSlug, section } = await params

  if (!/^[1-9]\d*$/.test(spoonerSlug)) {
    notFound()
  }

  const item = roleWorkspaces.spooner.navItems.find(
    (navItem) => navItem.value === section
  )

  if (!item) {
    notFound()
  }

  return <WorkspacePlaceholder role="spooner" title={item.label} />
}
