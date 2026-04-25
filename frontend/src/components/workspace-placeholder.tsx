import type { AppRole } from "@/data/mock-navigation"

type WorkspacePlaceholderProps = {
  role: AppRole
  title: string
}

export function WorkspacePlaceholder({ role, title }: WorkspacePlaceholderProps) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xs">
        <p className="text-sm font-medium text-muted-foreground">
          {role === "cto" ? "CTO workspace" : "Spooner workspace"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This route is wired into navigation and ready for the next demo-critical
          screen.
        </p>
      </div>
    </div>
  )
}
