export type CapacityState = "under" | "at" | "over" | "none"

export const capacityColors: Record<CapacityState, string> = {
  under: "#EF4444",
  at: "#10B981",
  over: "#F97316",
  none: "#A1A1AA",
}

export function getCapacityState(
  team: number,
  required: number | null
): CapacityState {
  if (!required || required <= 0) return "none"
  if (team < required) return "under"
  if (team === required) return "at"
  return "over"
}

type CapacityRingProps = {
  size: number
  state: CapacityState
  strokeWidth?: number
  arcFraction?: number
}

export function CapacityRing({
  size,
  state,
  strokeWidth = 7,
  arcFraction = 0.78,
}: CapacityRingProps) {
  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const arcLength = circumference * arcFraction
  const startAngle = 90 + ((1 - arcFraction) / 2) * 360

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="absolute inset-0"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--donut-track)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={capacityColors[state]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${arcLength} ${circumference}`}
        transform={`rotate(${startAngle} ${center} ${center})`}
      />
    </svg>
  )
}
