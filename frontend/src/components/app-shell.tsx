"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"

import {
  currentUser,
  roleWorkspaces,
  type AppRole,
} from "@/data/mock-navigation"
import { SidebarNav } from "@/components/sidebar-nav"
import { Topbar } from "@/components/topbar"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  preferenceCookieMaxAge,
  sidebarCollapsedCookieName,
  themeModeCookieName,
  type ThemeMode,
} from "@/lib/ui-preferences"

type AppShellProps = {
  initialSidebarCollapsed: boolean
  initialThemeMode: ThemeMode
  initialRole?: AppRole
  children: ReactNode
}

function writePreferenceCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${preferenceCookieMaxAge}; samesite=lax`
}

export function AppShell({
  initialSidebarCollapsed,
  initialThemeMode,
  initialRole = "cto",
  children,
}: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed)
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialThemeMode)

  const role: AppRole = pathname.startsWith("/spooner")
    ? "spooner"
    : pathname.startsWith("/cto")
      ? "cto"
      : initialRole
  const workspace = roleWorkspaces[role]

  const activeNavItem = useMemo(() => {
    return (
      workspace.navItems.find((item) => pathname.startsWith(item.href)) ??
      workspace.navItems[0]
    )
  }, [pathname, workspace.navItems])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    function applyTheme() {
      const shouldUseDark =
        themeMode === "dark" ||
        (themeMode === "auto" && mediaQuery.matches)

      document.documentElement.classList.toggle("dark", shouldUseDark)
    }

    applyTheme()
    mediaQuery.addEventListener("change", applyTheme)

    return () => mediaQuery.removeEventListener("change", applyTheme)
  }, [themeMode])

  function handleRoleChange(nextRole: AppRole) {
    router.push(roleWorkspaces[nextRole].navItems[0].href)
  }

  function handleSidebarCollapsedChange(collapsed: boolean) {
    setSidebarCollapsed(collapsed)
    window.localStorage.setItem(sidebarCollapsedCookieName, String(collapsed))
    writePreferenceCookie(sidebarCollapsedCookieName, String(collapsed))
  }

  function handleThemeModeChange(mode: ThemeMode) {
    setThemeMode(mode)
    window.localStorage.setItem(themeModeCookieName, mode)
    writePreferenceCookie(themeModeCookieName, mode)
  }

  return (
    <TooltipProvider>
      <div className="min-h-svh bg-background text-foreground">
        <div className="flex min-h-svh">
          <SidebarNav
            workspace={workspace}
            activeItem={activeNavItem.value}
            role={role}
            onRoleChange={handleRoleChange}
            user={currentUser}
            collapsed={sidebarCollapsed}
            themeMode={themeMode}
            onThemeModeChange={handleThemeModeChange}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar
              workspace={workspace}
              activeLabel={activeNavItem.label}
              primaryAction={activeNavItem.primaryAction ?? workspace.primaryAction}
              sidebarCollapsed={sidebarCollapsed}
              onSidebarCollapsedChange={handleSidebarCollapsedChange}
            />

            <main className="flex-1 overflow-hidden">{children}</main>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
