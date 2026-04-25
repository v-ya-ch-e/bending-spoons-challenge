import { notFound, redirect } from "next/navigation"

import { WorkspacePlaceholder } from "@/components/workspace-placeholder"
import { roleWorkspaces } from "@/data/mock-navigation"

type SpoonerSlugPageProps = {
  params: Promise<{
    spoonerSlug: string
  }>
}

export default async function SpoonerSlugPage({ params }: SpoonerSlugPageProps) {
  const { spoonerSlug } = await params
  const employeeId = parsePositiveInt(spoonerSlug)
  if (employeeId !== null) {
    redirect(`/spooner/${employeeId}/my-project`)
  }

  const item = roleWorkspaces.spooner.navItems.find(
    (navItem) => navItem.value === spoonerSlug
  )

  if (!item) {
    notFound()
  }

  return <WorkspacePlaceholder role="spooner" title={item.label} />
}

function parsePositiveInt(value: string) {
  if (!/^[1-9]\d*$/.test(value)) {
    return null
  }

  return Number(value)
}
