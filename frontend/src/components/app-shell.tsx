"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"

import {
  currentUser,
  roleWorkspaces,
  type AppRole,
  type NavItem,
} from "@/data/mock-navigation"
import { SidebarNav } from "@/components/sidebar-nav"
import { Topbar } from "@/components/topbar"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  getCachedEmployees,
  getCachedMatchingRuns,
  getCachedProjects,
  listEmployees,
  listMatchingRuns,
  listProjects,
} from "@/lib/db-api"
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
  const [projectCount, setProjectCount] = useState<number | undefined>(
    () => getCachedProjects()?.length
  )
  const [employeeCount, setEmployeeCount] = useState<number | undefined>(
    () => getCachedEmployees()?.length
  )
  const [matchingRunCount, setMatchingRunCount] = useState<number | undefined>(
    () => getCachedMatchingRuns()?.length
  )

  const role: AppRole = pathname.startsWith("/spooner")
    ? "spooner"
    : pathname.startsWith("/cto")
      ? "cto"
      : initialRole
  const baseWorkspace = roleWorkspaces[role]

  const workspace = useMemo(() => {
    const navItems: NavItem[] = baseWorkspace.navItems.map((item) => {
      if (item.value === "projects" && projectCount !== undefined) {
        return { ...item, count: String(projectCount) }
      }
      if (item.value === "employees" && employeeCount !== undefined) {
        return { ...item, count: String(employeeCount) }
      }
      if (item.value === "matching" && matchingRunCount !== undefined) {
        return { ...item, count: String(matchingRunCount) }
      }
      return item
    })
    return { ...baseWorkspace, navItems }
  }, [baseWorkspace, projectCount, employeeCount, matchingRunCount])

  const activeNavItem = useMemo(() => {
    return (
      workspace.navItems.find((item) => pathname.startsWith(item.href)) ??
      workspace.navItems[0]
    )
  }, [pathname, workspace.navItems])

  useEffect(() => {
    let isMounted = true

    listProjects()
      .then((projects) => {
        if (isMounted) setProjectCount(projects.length)
      })
      .catch(() => {})

    listEmployees()
      .then((employees) => {
        if (isMounted) setEmployeeCount(employees.length)
      })
      .catch(() => {})

    listMatchingRuns()
      .then((runs) => {
        if (isMounted) setMatchingRunCount(runs.length)
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [pathname])

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
      <div className="h-svh overflow-hidden bg-background text-foreground">
        <div className="flex h-full min-h-0">
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

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Topbar
              workspace={workspace}
              activeLabel={activeNavItem.label}
              primaryAction={activeNavItem.primaryAction ?? workspace.primaryAction}
              primaryActionHref={activeNavItem.primaryActionHref}
              sidebarCollapsed={sidebarCollapsed}
              onSidebarCollapsedChange={handleSidebarCollapsedChange}
            />

            <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
