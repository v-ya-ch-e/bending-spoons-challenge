import { RailCard } from "./right-rail-card"

type TotalEngineersCardProps = {
  total: number
  assigned: number
  unassigned: number
}

export function TotalEngineersCard({
  total,
  assigned,
  unassigned,
}: TotalEngineersCardProps) {
  return (
    <RailCard>
      <h3 className="text-sm font-semibold text-foreground">Total engineers</h3>
      <p className="text-[34px] font-semibold leading-none tabular-nums text-foreground">
        {total}
      </p>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Assigned</span>
          <span className="font-medium tabular-nums text-foreground">
            {assigned}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Unassigned</span>
          <span className="font-medium tabular-nums text-foreground">
            {unassigned}
          </span>
        </div>
      </div>
    </RailCard>
  )
}
