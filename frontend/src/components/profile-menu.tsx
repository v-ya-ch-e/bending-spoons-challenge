"use client"

import { useState, type ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Logout03Icon,
  Settings01Icon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons"

import type { AppRole } from "@/data/mock-navigation"
import type { Employee } from "@/lib/db-api"
import type { ThemeMode } from "@/lib/ui-preferences"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
  themeMode: ThemeMode
  onThemeModeChange: (mode: ThemeMode) => void
  spoonerId: number | null
  spoonerOptions: Employee[]
  onSpoonerChange: (id: number) => void
  compact?: boolean
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?"
}

const roleItems: Array<{
  value: AppRole
  label: string
}> = [
  { value: "cto", label: "CTO" },
  { value: "spooner", label: "Spooner" },
]

const themeItems: Array<{
  value: ThemeMode
  label: string
}> = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
]

export function ProfileMenu({
  user,
  role,
  onRoleChange,
  themeMode,
  onThemeModeChange,
  spoonerId,
  spoonerOptions,
  onSpoonerChange,
  compact,
}: ProfileMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "pointer-events-auto rounded-3xl bg-muted/50",
            compact
              ? "size-10 justify-center rounded-2xl p-0"
              : "min-h-16 w-full justify-between gap-3 px-4 py-3"
          )}
          aria-label="Open profile menu"
        >
          <span className="flex min-w-0 items-center gap-3">
            <Avatar size={compact ? "default" : "lg"}>
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
          {!compact && (
            <HugeiconsIcon
              icon={UnfoldMoreIcon}
              strokeWidth={2}
              className="size-4 text-muted-foreground"
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2">
        <DropdownMenuLabel>
          <span className="block text-sm font-medium text-foreground">
            {user.name}
          </span>
          <span className="block truncate text-xs">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <SwitchRow label="View">
          <SegmentedControl>
            {roleItems.map((item) => (
              <SegmentButton
                key={item.value}
                active={item.value === role}
                onClick={() => onRoleChange(item.value)}
              >
                {item.label}
              </SegmentButton>
            ))}
          </SegmentedControl>
        </SwitchRow>
        {role === "spooner" && (
          <SwitchRow label="Spooner">
            <SpoonerPicker
              spoonerId={spoonerId}
              spoonerOptions={spoonerOptions}
              onSpoonerChange={onSpoonerChange}
            />
          </SwitchRow>
        )}
        <SwitchRow label="Theme">
          <SegmentedControl>
            {themeItems.map((item) => (
              <SegmentButton
                key={item.value}
                active={item.value === themeMode}
                onClick={() => onThemeModeChange(item.value)}
              >
                {item.label}
              </SegmentButton>
            ))}
          </SegmentedControl>
        </SwitchRow>
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

function SwitchRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}

function SegmentedControl({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex shrink-0 rounded-full bg-muted p-1">
      {children}
    </div>
  )
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-7 min-w-14 cursor-pointer rounded-full px-2.5 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function SpoonerPicker({
  spoonerId,
  spoonerOptions,
  onSpoonerChange,
}: {
  spoonerId: number | null
  spoonerOptions: Employee[]
  onSpoonerChange: (id: number) => void
}) {
  const [open, setOpen] = useState(false)

  if (spoonerOptions.length === 0) {
    return (
      <span className="truncate text-xs text-muted-foreground">
        Loading spooners...
      </span>
    )
  }

  const selected =
    spoonerOptions.find((employee) => employee.id === spoonerId) ?? null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          aria-label="Choose spooner"
          aria-expanded={open}
          className="h-8 max-w-[180px] min-w-0 justify-between gap-2 rounded-full bg-muted px-3 text-xs font-medium"
        >
          <span className="truncate">
            {selected ? selected.name : "Pick spooner"}
          </span>
          <HugeiconsIcon
            icon={UnfoldMoreIcon}
            strokeWidth={2}
            className="size-3.5 shrink-0 text-muted-foreground"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search spooners..." />
          <CommandList>
            <CommandEmpty>No spooners found.</CommandEmpty>
            <CommandGroup>
              {[...spoonerOptions]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((employee) => (
                  <CommandItem
                    key={employee.id}
                    value={`${employee.name} ${employee.role}`}
                    data-checked={employee.id === spoonerId}
                    onSelect={() => {
                      onSpoonerChange(employee.id)
                      setOpen(false)
                    }}
                  >
                    <Avatar size="sm">
                      <AvatarFallback>
                        {getInitials(employee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {employee.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {employee.role}
                      </span>
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
