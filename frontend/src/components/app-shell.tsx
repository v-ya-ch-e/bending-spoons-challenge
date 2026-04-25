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

const sidebarStorageKey = "talent-os-sidebar-collapsed"

export function AppShell() {
  const [role, setRole] = useState<AppRole>("cto")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
    const frame = window.requestAnimationFrame(() => {
      setSidebarCollapsed(
        window.localStorage.getItem(sidebarStorageKey) === "true"
      )
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  function handleRoleChange(nextRole: AppRole) {
    setRole(nextRole)
  }

  function handleActiveItemChange(value: string) {
    setActiveByRole((current) => ({ ...current, [role]: value }))
  }

  function handleSidebarCollapsedChange(collapsed: boolean) {
    setSidebarCollapsed(collapsed)
    window.localStorage.setItem(sidebarStorageKey, String(collapsed))
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
