"use client"

import Image from "next/image"
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
import { Separator } from "@/components/ui/separator"
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
  onActiveItemChange: (value: string) => void
  onRoleChange: (role: AppRole) => void
  user: {
    name: string
    email: string
    initials: string
    team: string
  }
  collapsed: boolean
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
  onActiveItemChange,
  onRoleChange,
  user,
  collapsed,
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
            "h-11 w-auto origin-left transition-[opacity,transform] duration-300 ease-out",
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
            "absolute left-1/2 h-8 w-auto -translate-x-1/2 origin-center transition-[opacity,transform] duration-300 ease-out",
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
            <button
              key={item.value}
              type="button"
              onClick={() => onActiveItemChange(item.value)}
              className={cn(
                "group flex h-10 w-full items-center rounded-2xl text-left text-sm transition-[background-color,color,padding,gap] duration-200 ease-out",
                collapsed ? "justify-center gap-0 px-0" : "gap-3 px-3",
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
                  "min-w-0 flex-1 overflow-hidden transition-[opacity,width] duration-150 ease-out",
                  collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
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
            </button>
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
        <Separator className="mb-3" />
        <div
          className={cn(
            "rounded-3xl bg-muted/50 p-1.5 transition-colors",
            collapsed && "bg-transparent p-0"
          )}
        >
          <ProfileMenu
            user={user}
            role={role}
            onRoleChange={onRoleChange}
            compact={collapsed}
          />
        </div>
      </div>
    </aside>
  )
}
