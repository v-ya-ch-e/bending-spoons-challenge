import { notFound } from "next/navigation"

import { TransitionInstructionScreen } from "@/components/transitions/transition-instruction-screen"

type EmployeeOnboardingPageProps = {
  params: Promise<{
    spoonerId: string
  }>
}

export default async function EmployeeOnboardingPage({
  params,
}: EmployeeOnboardingPageProps) {
  const { spoonerId } = await params
  const employeeId = parsePositiveInt(spoonerId)

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
