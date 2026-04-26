"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
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
  type Employee,
} from "@/lib/db-api"
import type { AppShellInitialData } from "@/lib/server/db-api"
import {
  preferenceCookieMaxAge,
  sidebarCollapsedCookieName,
  spoonerIdCookieName,
  themeModeCookieName,
  type ThemeMode,
} from "@/lib/ui-preferences"

type AppShellProps = {
  initialSidebarCollapsed: boolean
  initialThemeMode: ThemeMode
  initialRole?: AppRole
  initialSpoonerId?: number | null
  initialData?: AppShellInitialData | null
  children: ReactNode
}

const spoonerPathRegex = /^\/spooner\/(\d+)(?:\/|$)/
const defaultSpoonerSection = "my-project"

function writePreferenceCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${preferenceCookieMaxAge}; samesite=lax`
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?"
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "") || "spooner"
  )
}

function buildSpoonerUser(employee: Employee) {
  return {
    name: employee.name,
    email: `${slugify(employee.name)}@bendingspoons.com`,
    initials: getInitials(employee.name),
    team: employee.role,
  }
}

export function AppShell({
  initialSidebarCollapsed,
  initialThemeMode,
  initialRole = "cto",
  initialSpoonerId = null,
  initialData,
  children,
}: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed)
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialThemeMode)
  const [savedSpoonerId, setSavedSpoonerId] = useState<number | null>(
    initialSpoonerId
  )
  const savedSpoonerIdRef = useRef(savedSpoonerId)
  const [employees, setEmployees] = useState<Employee[]>(
    () => initialData?.employees ?? getCachedEmployees() ?? []
  )
  const [projectCount, setProjectCount] = useState<number | undefined>(
    () => initialData?.projectCount ?? getCachedProjects()?.length
  )
  const [employeeCount, setEmployeeCount] = useState<number | undefined>(
    () => initialData?.employeeCount ?? getCachedEmployees()?.length
  )
  const [matchingRunCount, setMatchingRunCount] = useState<number | undefined>(
    () => initialData?.matchingRunCount ?? getCachedMatchingRuns()?.length
  )
  const shouldSkipInitialRefreshRef = useRef(Boolean(initialData))

  const role: AppRole = pathname.startsWith("/spooner")
    ? "spooner"
    : pathname.startsWith("/cto")
      ? "cto"
      : initialRole

  const urlSpoonerId = useMemo(() => {
    const match = pathname.match(spoonerPathRegex)
    if (!match) return null
    const parsed = Number.parseInt(match[1], 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [pathname])

  const activeSpoonerId = urlSpoonerId ?? savedSpoonerId
  const selectedSpooner = useMemo(
    () => employees.find((employee) => employee.id === activeSpoonerId) ?? null,
    [employees, activeSpoonerId]
  )

  const displayedUser = useMemo(() => {
    if (role === "spooner" && selectedSpooner) {
      return buildSpoonerUser(selectedSpooner)
    }
    return currentUser
  }, [role, selectedSpooner])

  const baseWorkspace = roleWorkspaces[role]

  const workspace = useMemo(() => {
    const navItems: NavItem[] = baseWorkspace.navItems.map((item) => {
      const nextItem: NavItem =
        role === "spooner" && urlSpoonerId !== null
          ? { ...item, href: `/spooner/${urlSpoonerId}/${item.value}` }
          : item

      if (nextItem.value === "projects" && projectCount !== undefined) {
        return { ...nextItem, count: String(projectCount) }
      }
      if (nextItem.value === "employees" && employeeCount !== undefined) {
        return { ...nextItem, count: String(employeeCount) }
      }
      if (nextItem.value === "matching" && matchingRunCount !== undefined) {
        return { ...nextItem, count: String(matchingRunCount) }
      }
      return nextItem
    })
    return { ...baseWorkspace, navItems }
  }, [
    baseWorkspace,
    role,
    urlSpoonerId,
    projectCount,
    employeeCount,
    matchingRunCount,
  ])

  const activeNavItem = useMemo(() => {
    return (
      workspace.navItems.find((item) => pathname.startsWith(item.href)) ??
      workspace.navItems[0]
    )
  }, [pathname, workspace.navItems])

  useEffect(() => {
    if (shouldSkipInitialRefreshRef.current) {
      shouldSkipInitialRefreshRef.current = false
      return
    }

    let isMounted = true

    listProjects()
      .then((projects) => {
        if (isMounted) setProjectCount(projects.length)
      })
      .catch(() => {})

    listEmployees()
      .then((nextEmployees) => {
        if (!isMounted) return
        setEmployees(nextEmployees)
        setEmployeeCount(nextEmployees.length)
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
    if (urlSpoonerId !== null && urlSpoonerId !== savedSpoonerId) {
      savedSpoonerIdRef.current = urlSpoonerId
      window.localStorage.setItem(spoonerIdCookieName, String(urlSpoonerId))
      writePreferenceCookie(spoonerIdCookieName, String(urlSpoonerId))
    }
  }, [urlSpoonerId, savedSpoonerId])

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
    if (nextRole === "spooner") {
      const targetId = urlSpoonerId ?? savedSpoonerIdRef.current
      if (targetId !== null) {
        router.push(`/spooner/${targetId}/${defaultSpoonerSection}`)
      } else {
        router.push("/spooner")
      }
      return
    }
    router.push(roleWorkspaces[nextRole].navItems[0].href)
  }

  function handleSpoonerChange(nextId: number) {
    savedSpoonerIdRef.current = nextId
    setSavedSpoonerId(nextId)
    window.localStorage.setItem(spoonerIdCookieName, String(nextId))
    writePreferenceCookie(spoonerIdCookieName, String(nextId))
    const nextSection = activeNavItem?.value ?? defaultSpoonerSection
    router.push(`/spooner/${nextId}/${nextSection}`)
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
            user={displayedUser}
            collapsed={sidebarCollapsed}
            themeMode={themeMode}
            onThemeModeChange={handleThemeModeChange}
            spoonerId={activeSpoonerId}
            spoonerOptions={employees}
            onSpoonerChange={handleSpoonerChange}
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
