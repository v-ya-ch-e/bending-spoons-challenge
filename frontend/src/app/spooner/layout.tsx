import { cookies } from "next/headers"

import { AppShell } from "@/components/app-shell"
import {
  parseSidebarCollapsed,
  parseThemeMode,
  sidebarCollapsedCookieName,
  themeModeCookieName,
} from "@/lib/ui-preferences"

export default async function SpoonerLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()

  return (
    <AppShell
      initialRole="spooner"
      initialSidebarCollapsed={parseSidebarCollapsed(
        cookieStore.get(sidebarCollapsedCookieName)?.value
      )}
      initialThemeMode={parseThemeMode(cookieStore.get(themeModeCookieName)?.value)}
    >
      {children}
    </AppShell>
  )
}
