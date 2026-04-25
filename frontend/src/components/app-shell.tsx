"use client"

import { useEffect, useMemo, useState } from "react"

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
}

function writePreferenceCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${preferenceCookieMaxAge}; samesite=lax`
}

export function AppShell({
  initialSidebarCollapsed,
  initialThemeMode,
}: AppShellProps) {
  const [role, setRole] = useState<AppRole>("cto")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed)
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialThemeMode)
  const [activeByRole, setActiveByRole] = useState<Record<AppRole, string>>({
    cto: roleWorkspaces.cto.navItems[0].value,
    spooner: roleWorkspaces.spooner.navItems[0].value,
  })

  const workspace = roleWorkspaces[role]
  const activeItem = activeByRole[role]

  const activeNavItem = useMemo(
    () =>
      workspace.navItems.find((item) => item.value === activeItem) ??
      workspace.navItems[0],
    [activeItem, workspace.navItems]
  )

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
    setRole(nextRole)
  }

  function handleActiveItemChange(value: string) {
    setActiveByRole((current) => ({ ...current, [role]: value }))
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
            activeItem={activeItem}
            onActiveItemChange={handleActiveItemChange}
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
              sidebarCollapsed={sidebarCollapsed}
              onSidebarCollapsedChange={handleSidebarCollapsedChange}
            />

            <main className="flex-1" />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
