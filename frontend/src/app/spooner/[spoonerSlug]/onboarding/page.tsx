import { notFound } from "next/navigation"

import { TransitionInstructionScreen } from "@/components/transitions/transition-instruction-screen"

type EmployeeOnboardingPageProps = {
  params: Promise<{
    spoonerSlug: string
  }>
}

export default async function EmployeeOnboardingPage({
  params,
}: EmployeeOnboardingPageProps) {
  const { spoonerSlug } = await params
  const employeeId = parsePositiveInt(spoonerSlug)

  if (employeeId === null) {
    notFound()
  }

  return (
    <TransitionInstructionScreen
      employeeId={employeeId}
      instructionType="onboarding"
    />
  )
}

function parsePositiveInt(value: string) {
  if (!/^[1-9]\d*$/.test(value)) {
    return null
  }

  return Number(value)
}
