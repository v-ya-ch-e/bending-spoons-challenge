"use client"

import { useEffect, type ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type DetailSheetProps = {
  open: boolean
  onClose: () => void
  ariaLabel: string
  children: ReactNode
}

export function DetailSheet({
  open,
  onClose,
  ariaLabel,
  children,
}: DetailSheetProps) {
  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <>
      <div
        data-state={open ? "open" : "closed"}
        onClick={onClose}
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ease-out supports-backdrop-filter:backdrop-blur-sm",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        data-state={open ? "open" : "closed"}
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 flex w-[360px] max-w-[100vw] flex-col border-l border-border bg-background shadow-xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close detail panel"
          className="absolute right-3 top-3 z-10 bg-secondary"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
        <ScrollArea className="min-h-0 flex-1">{children}</ScrollArea>
      </aside>
    </>
  )
}

export function DetailSection({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  )
}
