"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Briefcase01Icon,
  CrownIcon,
  Logout03Icon,
  Settings01Icon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons"

import type { AppRole } from "@/data/mock-navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type ProfileMenuProps = {
  user: {
    name: string
    email: string
    initials: string
    team: string
  }
  role: AppRole
  onRoleChange: (role: AppRole) => void
  compact?: boolean
}

const roleItems: Array<{
  value: AppRole
  label: string
  icon: typeof CrownIcon
}> = [
  { value: "cto", label: "CTO", icon: CrownIcon },
  { value: "spooner", label: "Spooner", icon: Briefcase01Icon },
]

export function ProfileMenu({
  user,
  role,
  onRoleChange,
  compact,
}: ProfileMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "pointer-events-auto h-auto rounded-3xl px-2 py-2",
            compact ? "gap-2" : "w-full justify-between gap-3"
          )}
          aria-label="Open profile menu"
        >
          <span className="flex min-w-0 items-center gap-3">
            <Avatar>
              <AvatarFallback>{user.initials}</AvatarFallback>
            </Avatar>
            {!compact && (
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-medium">
                  {user.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </span>
            )}
          </span>
          <HugeiconsIcon
            icon={UnfoldMoreIcon}
            strokeWidth={2}
            className="size-4 text-muted-foreground"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block text-sm font-medium text-foreground">
            {user.name}
          </span>
          <span className="block truncate text-xs">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>View</DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-1 rounded-3xl bg-muted p-1">
          {roleItems.map((item) => {
            const isActive = item.value === role

            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => onRoleChange(item.value)}
                className={cn(
                  "flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-2xl text-xs font-medium transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                {item.label}
              </button>
            )
          })}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <HugeiconsIcon icon={Logout03Icon} strokeWidth={2} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
