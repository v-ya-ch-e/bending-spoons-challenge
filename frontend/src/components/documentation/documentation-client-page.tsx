"use client"

import dynamic from "next/dynamic"

const DocumentationScreen = dynamic(
  () =>
    import("@/components/documentation/documentation-screen").then(
      (module) => module.DocumentationScreen
    ),
  { ssr: false }
)

export function DocumentationClientPage() {
  return <DocumentationScreen />
}
