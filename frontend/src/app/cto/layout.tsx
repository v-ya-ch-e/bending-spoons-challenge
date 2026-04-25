import { cookies } from "next/headers"

import { AppShell } from "@/components/app-shell"
import {
  parseSidebarCollapsed,
  parseSpoonerId,
  parseThemeMode,
  sidebarCollapsedCookieName,
  spoonerIdCookieName,
  themeModeCookieName,
} from "@/lib/ui-preferences"

export default async function CtoLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()

  return (
    <AppShell
      initialRole="cto"
      initialSidebarCollapsed={parseSidebarCollapsed(
        cookieStore.get(sidebarCollapsedCookieName)?.value
      )}
      initialThemeMode={parseThemeMode(cookieStore.get(themeModeCookieName)?.value)}
      initialSpoonerId={parseSpoonerId(cookieStore.get(spoonerIdCookieName)?.value)}
    >
      {children}
    </AppShell>
  )
}
