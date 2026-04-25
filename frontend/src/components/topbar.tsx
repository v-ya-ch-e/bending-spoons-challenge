"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  SidebarLeftIcon,
  SidebarRightIcon,
} from "@hugeicons/core-free-icons"

import type { RoleWorkspace } from "@/data/mock-navigation"
import { Button } from "@/components/ui/button"

type TopbarProps = {
  workspace: RoleWorkspace
  activeLabel: string
  primaryAction: string
  primaryActionHref?: string
  sidebarCollapsed: boolean
  onSidebarCollapsedChange: (collapsed: boolean) => void
}

export function Topbar({
  workspace,
  activeLabel,
  primaryAction,
  primaryActionHref,
  sidebarCollapsed,
  onSidebarCollapsedChange,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-3 backdrop-blur-xl sm:px-4 lg:px-4">
      <div className="flex h-14 min-w-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="-ml-1 rounded-2xl"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={sidebarCollapsed}
            onClick={() => onSidebarCollapsedChange(!sidebarCollapsed)}
          >
            <HugeiconsIcon
              icon={sidebarCollapsed ? SidebarRightIcon : SidebarLeftIcon}
              strokeWidth={2}
            />
          </Button>

          <nav
            className="flex min-w-0 items-center gap-2 text-sm"
            aria-label="Breadcrumb"
          >
            <span className="shrink-0 font-medium">Talent OS</span>
            <span className="shrink-0 text-muted-foreground">/</span>
            <span className="shrink-0 text-muted-foreground">
              {workspace.label}
            </span>
            <span className="shrink-0 text-muted-foreground">/</span>
            <span className="min-w-0 truncate text-foreground">{activeLabel}</span>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {primaryActionHref ? (
            <Button asChild size="sm" className="rounded-full">
              <Link href={primaryActionHref}>
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
                {primaryAction}
              </Link>
            </Button>
          ) : (
            <Button type="button" size="sm" className="rounded-full">
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
              {primaryAction}
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
