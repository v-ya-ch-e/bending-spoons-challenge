"use client"

import Image from "next/image"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BookOpen01Icon,
  Briefcase01Icon,
  ChartRelationshipIcon,
  CheckListIcon,
  DashboardSquare01Icon,
  DocumentValidationIcon,
  Folder01Icon,
  Notification03Icon,
  Task01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"

import type { AppRole, RoleWorkspace } from "@/data/mock-navigation"
import type { ThemeMode } from "@/lib/ui-preferences"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ProfileMenu } from "@/components/profile-menu"
import { cn } from "@/lib/utils"

type SidebarNavProps = {
  role: AppRole
  workspace: RoleWorkspace
  activeItem: string
  onRoleChange: (role: AppRole) => void
  user: {
    name: string
    email: string
    initials: string
    team: string
  }
  collapsed: boolean
  themeMode: ThemeMode
  onThemeModeChange: (mode: ThemeMode) => void
}

const navIcons = {
  overview: DashboardSquare01Icon,
  projects: Folder01Icon,
  employees: UserGroupIcon,
  matching: ChartRelationshipIcon,
  documentation: DocumentValidationIcon,
  "my-project": Briefcase01Icon,
  requests: Notification03Icon,
  onboarding: CheckListIcon,
  offboarding: Task01Icon,
  resources: BookOpen01Icon,
}

export function SidebarNav({
  role,
  workspace,
  activeItem,
  onRoleChange,
  user,
  collapsed,
  themeMode,
  onThemeModeChange,
}: SidebarNavProps) {
  return (
    <aside
      className={cn(
        "flex min-h-svh shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar py-5 text-sidebar-foreground transition-[width,padding] duration-200 ease-out",
        collapsed ? "w-18 px-3" : "w-64 px-4"
      )}
    >
      <div
        className={cn(
          "relative flex h-11 items-center overflow-hidden transition-all duration-300 ease-out",
          collapsed ? "justify-center" : "justify-start"
        )}
      >
        <Image
          src="/logo_bending_spoons.svg"
          alt="Bending Spoons"
          width={410}
          height={190}
          priority
          className={cn(
            "h-11 w-auto origin-left transition-[opacity,transform] duration-300 ease-out dark:hidden",
            collapsed
              ? "pointer-events-none scale-95 opacity-0"
              : "scale-100 opacity-100"
          )}
        />
        <Image
          src="/logo_bending_spoons_dark.svg"
          alt="Bending Spoons"
          width={410}
          height={190}
          priority
          className={cn(
            "hidden h-11 w-auto origin-left transition-[opacity,transform] duration-300 ease-out dark:block",
            collapsed
              ? "pointer-events-none scale-95 opacity-0"
              : "scale-100 opacity-100"
          )}
        />
        <Image
          src="/logo_bending_spoons_icon.svg"
          alt="Bending Spoons"
          width={107}
          height={57}
          priority
          className={cn(
            "absolute left-1/2 h-5 w-auto -translate-x-1/2 origin-center transition-[opacity,transform] duration-300 ease-out dark:hidden",
            collapsed
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-90 opacity-0"
          )}
        />
        <Image
          src="/logo_bending_spoons_icon_dark.svg"
          alt="Bending Spoons"
          width={107}
          height={57}
          priority
          className={cn(
            "absolute left-1/2 hidden h-5 w-auto -translate-x-1/2 origin-center transition-[opacity,transform] duration-300 ease-out dark:block",
            collapsed
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-90 opacity-0"
          )}
        />
      </div>

      <nav className="mt-7 flex flex-1 flex-col gap-0.5" aria-label="Primary">
        {workspace.navItems.map((item) => {
          const isActive = item.value === activeItem
          const icon = navIcons[item.value as keyof typeof navIcons]

          const navButton = (
            <Link
              key={item.value}
              href={item.href}
              className={cn(
                "group flex h-10 items-center rounded-2xl text-left text-sm transition-[background-color,color,padding,gap,width] duration-200 ease-out",
                collapsed ? "w-10 justify-center gap-0 px-0" : "w-full gap-3 px-3",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4.5" />
              </span>
              <span
                className={cn(
                  "min-w-0 overflow-hidden transition-[opacity,width] duration-150 ease-out",
                  collapsed
                    ? "w-0 flex-none opacity-0"
                    : "w-auto flex-1 opacity-100"
                )}
              >
                <span className="block truncate text-sm font-medium">
                  {item.label}
                </span>
              </span>
              {item.count && !collapsed && (
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 py-0.5 text-center text-xs font-medium",
                    isActive ? "bg-background text-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.count}
                </span>
              )}
            </Link>
          )

          if (!collapsed) {
            return navButton
          }

          return (
            <Tooltip key={item.value}>
              <TooltipTrigger asChild>{navButton}</TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </nav>

      <div className="mt-6">
        <ProfileMenu
          user={user}
          role={role}
          onRoleChange={onRoleChange}
          compact={collapsed}
          themeMode={themeMode}
          onThemeModeChange={onThemeModeChange}
        />
      </div>
    </aside>
  )
}
