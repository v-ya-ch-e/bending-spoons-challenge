import { notFound } from "next/navigation"

import { TransitionInstructionScreen } from "@/components/transitions/transition-instruction-screen"

type EmployeeOffboardingPageProps = {
  params: Promise<{
    spoonerSlug: string
  }>
}

export default async function EmployeeOffboardingPage({
  params,
}: EmployeeOffboardingPageProps) {
  const { spoonerSlug } = await params
  const employeeId = parsePositiveInt(spoonerSlug)

  if (employeeId === null) {
    notFound()
  }

  return (
    <TransitionInstructionScreen
      employeeId={employeeId}
      instructionType="offboarding"
    />
  )
}

function parsePositiveInt(value: string) {
  if (!/^[1-9]\d*$/.test(value)) {
    return null
  }

  return Number(value)
}
