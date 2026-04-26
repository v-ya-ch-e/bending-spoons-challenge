import { cookies } from "next/headers"

import { AppShell } from "@/components/app-shell"
import { loadAppShellInitialData } from "@/lib/server/db-api"
import {
  parseSidebarCollapsed,
  parseSpoonerId,
  parseThemeMode,
  sidebarCollapsedCookieName,
  spoonerIdCookieName,
  themeModeCookieName,
} from "@/lib/ui-preferences"

export default async function SpoonerLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const initialData = await loadAppShellInitialData()

  return (
    <AppShell
      initialRole="spooner"
      initialSidebarCollapsed={parseSidebarCollapsed(
        cookieStore.get(sidebarCollapsedCookieName)?.value
      )}
      initialThemeMode={parseThemeMode(cookieStore.get(themeModeCookieName)?.value)}
      initialSpoonerId={parseSpoonerId(cookieStore.get(spoonerIdCookieName)?.value)}
      initialData={initialData}
    >
      {children}
    </AppShell>
  )
}
