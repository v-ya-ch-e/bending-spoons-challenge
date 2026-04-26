"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
  Maximize01Icon,
} from "@hugeicons/core-free-icons"

import type { Employee, MoveRequest, Project } from "@/lib/db-api"
import { getNodeLayout, type LayoutMode } from "@/lib/overview/layouts"
import { capacityColors, getCapacityState } from "./capacity-ring"
import { InitialAvatar } from "./initial-avatar"
import { cn } from "@/lib/utils"

const phaseDotColors: Record<Project["project_phase"], string> = {
  growth: "#10B981",
  maintenance: "#64748B",
  "new acquisition": "#7C3AED",
}

const phaseLabels: Record<Project["project_phase"], string> = {
  growth: "Growth",
  maintenance: "Maintenance",
  "new acquisition": "New acquisition",
}

const NODE_WIDTH = 198
const NODE_HEIGHT = 86
const NODE_HALF_SIZE: HalfSize = { w: NODE_WIDTH / 2, h: NODE_HEIGHT / 2 }
const HUB_SIZE = 86
const UNASSIGNED_WIDTH = 126
const UNASSIGNED_HEIGHT = 56
const UNASSIGNED_HALF_SIZE: HalfSize = {
  w: UNASSIGNED_WIDTH / 2,
  h: UNASSIGNED_HEIGHT / 2,
}
const EDGE_AVATAR_SIZE = 28
const EDGE_END_PADDING = 8
const ARROW_LENGTH = 10
const ARROW_HALF_WIDTH = 5
const EDGE_BASE_CURVE_FRACTION = 0.16
const EDGE_STEP_CURVE_FRACTION = 0.1
const LAYOUT_PADDING = 56

const MIN_SCALE = 0.5
const MAX_SCALE = 2.5
const FIT_SCALE = 0.86
const ZOOM_STEP = 1.25
const WHEEL_STEP = 1.1

type ZoomState = { scale: number; x: number; y: number }
const DEFAULT_ZOOM: ZoomState = { scale: FIT_SCALE, x: 0, y: 0 }

const capacityLabels = {
  under: "Open seats",
  at: "Fulfilled",
  over: "Overbooked",
  none: "No target",
} as const

type FocusLevel = "focus" | "related" | "dim" | "idle"
type Point = { x: number; y: number }
type HalfSize = { w: number; h: number }
type HoveredNode = number | "unassigned" | null

type EdgeData = {
  move: MoveRequest
  fromId: number | null
  toId: number
  start: Point
  control: Point
  end: Point
  mid: Point
  arrowAngle: number
  key: string
}

type PortfolioGraphProps = {
  projects: Project[]
  unassignedEmployees: Employee[]
  pendingMoves: MoveRequest[]
  selectedProjectId?: number
  selectedEmployeeId?: number
  onProjectClick: (projectId: number) => void
  onEmployeeClick: (employeeId: number) => void
  onUnassignedClick: () => void
  layoutMode?: LayoutMode
}

export function PortfolioGraph({
  projects,
  unassignedEmployees,
  pendingMoves,
  selectedProjectId,
  selectedEmployeeId,
  onProjectClick,
  onEmployeeClick,
  onUnassignedClick,
  layoutMode = "force",
}: PortfolioGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState<ZoomState>(DEFAULT_ZOOM)
  const [isPanning, setIsPanning] = useState(false)
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<HoveredNode>(null)
  const hasUserAdjustedViewRef = useRef(false)
  const panStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    function update() {
      if (!node) return
      const rect = node.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const getFitZoom = useCallback((width: number, height: number): ZoomState => {
    return {
      scale: FIT_SCALE,
      x: (width * (1 - FIT_SCALE)) / 2,
      y: (height * (1 - FIT_SCALE)) / 2,
    }
  }, [])

  useEffect(() => {
    if (size.width === 0 || size.height === 0 || hasUserAdjustedViewRef.current) {
      return
    }
    setZoom(getFitZoom(size.width, size.height))
  }, [getFitZoom, size.width, size.height])

  const zoomAt = useCallback(
    (factor: number, originX: number, originY: number) => {
      setZoom((current) => {
        const newScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, current.scale * factor)
        )
        if (newScale === current.scale) return current
        const ratio = newScale / current.scale
        return {
          scale: newScale,
          x: originX - ratio * (originX - current.x),
          y: originY - ratio * (originY - current.y),
        }
      })
    },
    []
  )

  const handleZoomIn = useCallback(() => {
    hasUserAdjustedViewRef.current = true
    zoomAt(ZOOM_STEP, size.width / 2, size.height / 2)
  }, [zoomAt, size.width, size.height])

  const handleZoomOut = useCallback(() => {
    hasUserAdjustedViewRef.current = true
    zoomAt(1 / ZOOM_STEP, size.width / 2, size.height / 2)
  }, [zoomAt, size.width, size.height])

  const handleFit = useCallback(() => {
    hasUserAdjustedViewRef.current = false
    setZoom(getFitZoom(size.width, size.height))
  }, [getFitZoom, size.width, size.height])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    function onWheel(e: WheelEvent) {
      if (!node) return
      e.preventDefault()
      const rect = node.getBoundingClientRect()
      const factor = e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP
      hasUserAdjustedViewRef.current = true
      zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top)
    }

    node.addEventListener("wheel", onWheel, { passive: false })
    return () => node.removeEventListener("wheel", onWheel)
  }, [zoomAt])

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest("button")) return
    hasUserAdjustedViewRef.current = true
    panStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: zoom.x,
      origY: zoom.y,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsPanning(true)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const pan = panStateRef.current
    if (!pan) return
    const dx = e.clientX - pan.startX
    const dy = e.clientY - pan.startY
    setZoom((current) => ({
      ...current,
      x: pan.origX + dx,
      y: pan.origY + dy,
    }))
  }

  function endPan(e: React.PointerEvent<HTMLDivElement>) {
    if (!panStateRef.current) return
    panStateRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Pointer may already be released; ignore.
    }
    setIsPanning(false)
  }

  const layout = useMemo(() => {
    if (size.width === 0 || size.height === 0) return null

    // Sort by id so each project keeps the same slot when the parent
    // re-renders or when other projects in the array change order. This is
    // what makes node positions stable across re-renders.
    const ordered = projects.slice().sort((a, b) => a.id - b.id)
    const positions = getNodeLayout(
      ordered.length,
      size.width,
      size.height,
      {
        mode: layoutMode,
        padding: LAYOUT_PADDING,
        nodeWidth: NODE_WIDTH,
        nodeHeight: NODE_HEIGHT,
        hubSize: HUB_SIZE,
      }
    )
    const center = { x: size.width / 2, y: size.height / 2 }
    const unassignedScreen = {
      x: size.width - 12 - UNASSIGNED_WIDTH / 2,
      y: 12 + UNASSIGNED_HEIGHT / 2,
    }
    const unassigned = {
      x: (unassignedScreen.x - zoom.x) / zoom.scale,
      y: (unassignedScreen.y - zoom.y) / zoom.scale,
    }

    const projectPositions = new Map<number, Point>()
    ordered.forEach((project, index) => {
      const position = positions[index]
      if (position) {
        projectPositions.set(project.id, position)
      }
    })

    return { projectPositions, center, unassigned }
  }, [projects, size, layoutMode, zoom.scale, zoom.x, zoom.y])

  const edges = useMemo<EdgeData[]>(() => {
    if (!layout) return []

    // Group moves by the *unordered* project pair so we can split A→B and
    // B→A onto opposite sides of the same axis, and stagger multiple
    // parallel edges in the same direction.
    const grouped = new Map<string, MoveRequest[]>()
    pendingMoves.forEach((move) => {
      const a = move.from_project_id ?? -1
      const b = move.to_project_id
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`
      const list = grouped.get(key) ?? []
      list.push(move)
      grouped.set(key, list)
    })

    const result: EdgeData[] = []

    grouped.forEach((moves, groupKey) => {
      const [loStr, hiStr] = groupKey.split("-")
      const lo = Number(loStr)
      const hi = Number(hiStr)

      // Resolve the canonical lo and hi node centers for this pair. lo === -1
      // means the "unassigned" pseudo-node. We compute the perpendicular axis
      // *once per group* from this canonical direction so anti-parallel edges
      // (A→B vs B→A) cleanly land on opposite sides of the same chord.
      const loCenter =
        lo === -1 ? layout.unassigned : layout.projectPositions.get(lo)
      const hiCenter = layout.projectPositions.get(hi)
      if (!loCenter || !hiCenter) return

      const cdx = hiCenter.x - loCenter.x
      const cdy = hiCenter.y - loCenter.y
      const cdist = Math.sqrt(cdx * cdx + cdy * cdy) || 1
      const perpX = -cdy / cdist
      const perpY = cdx / cdist

      let forwardCount = 0
      let backwardCount = 0

      moves.forEach((move) => {
        const fromId = move.from_project_id
        const isForward = (fromId ?? -1) === lo
        const startCenter = isForward ? loCenter : hiCenter
        const endCenter = isForward ? hiCenter : loCenter

        // slot is +1, +2, ... for the lo→hi direction and -1, -2, ... for
        // hi→lo. Same magnitude => same curvature; opposite sign => the
        // curve bows to the opposite side of the (canonical) chord, so
        // anti-parallel edges separate.
        const slot = isForward ? ++forwardCount : -(++backwardCount)
        const stepIndex = Math.abs(slot) - 1
        const curveFraction =
          EDGE_BASE_CURVE_FRACTION + stepIndex * EDGE_STEP_CURVE_FRACTION
        const sign = Math.sign(slot)

        const midBase = {
          x: (startCenter.x + endCenter.x) / 2,
          y: (startCenter.y + endCenter.y) / 2,
        }
        const offset = cdist * curveFraction * sign
        const control = {
          x: midBase.x + perpX * offset,
          y: midBase.y + perpY * offset,
        }

        // Clip both endpoints to the actual node rectangles (with a small
        // gap) so edges visually terminate on the card border instead of
        // the card center or floating outside the card.
        const startHalf =
          fromId !== null ? NODE_HALF_SIZE : UNASSIGNED_HALF_SIZE
        const start = clipToBoxToward(startCenter, startHalf, control)
        const end = clipToBoxToward(endCenter, NODE_HALF_SIZE, control)

        const mid = pickAvatarPoint(start, control, end, layout)
        const arrowAngle =
          (Math.atan2(end.y - control.y, end.x - control.x) * 180) / Math.PI

        result.push({
          move,
          fromId,
          toId: move.to_project_id,
          start,
          control,
          end,
          mid,
          arrowAngle,
          key: String(move.id),
        })
      })
    })

    return result
  }, [layout, pendingMoves])

  // ── Highlight / focus system ──────────────────────────────────────────
  const focusActive =
    selectedProjectId !== undefined ||
    selectedEmployeeId !== undefined ||
    hoveredEdgeKey !== null ||
    hoveredNodeId !== null

  const focusedMoveByEmployee = useMemo(
    () =>
      selectedEmployeeId !== undefined
        ? pendingMoves.find((m) => m.employee_id === selectedEmployeeId) ??
          null
        : null,
    [pendingMoves, selectedEmployeeId]
  )

  const hoveredEdge = useMemo(
    () =>
      hoveredEdgeKey
        ? edges.find((e) => e.key === hoveredEdgeKey) ?? null
        : null,
    [edges, hoveredEdgeKey]
  )

  function getEdgeFocus(edge: EdgeData): FocusLevel {
    if (edge.key === hoveredEdgeKey) return "focus"
    if (edge.move.employee_id === selectedEmployeeId) return "focus"

    const touchesHoveredNode =
      hoveredNodeId !== null &&
      ((hoveredNodeId === "unassigned" && edge.fromId === null) ||
        edge.fromId === hoveredNodeId ||
        edge.toId === hoveredNodeId)
    const touchesSelectedProject =
      selectedProjectId !== undefined &&
      (edge.fromId === selectedProjectId || edge.toId === selectedProjectId)
    if (touchesHoveredNode || touchesSelectedProject) return "related"

    return focusActive ? "dim" : "idle"
  }

  function getProjectFocus(projectId: number): FocusLevel {
    if (projectId === selectedProjectId || projectId === hoveredNodeId)
      return "focus"

    const isMoveEndpoint =
      focusedMoveByEmployee &&
      (focusedMoveByEmployee.from_project_id === projectId ||
        focusedMoveByEmployee.to_project_id === projectId)
    const isHoveredEdgeEndpoint =
      hoveredEdge &&
      (hoveredEdge.fromId === projectId || hoveredEdge.toId === projectId)
    if (isMoveEndpoint || isHoveredEdgeEndpoint) return "related"

    return focusActive ? "dim" : "idle"
  }

  function getUnassignedFocus(): FocusLevel {
    if (hoveredNodeId === "unassigned") return "focus"
    if (focusedMoveByEmployee && focusedMoveByEmployee.from_project_id === null)
      return "related"
    if (hoveredEdge && hoveredEdge.fromId === null) return "related"
    return focusActive ? "dim" : "idle"
  }

  const unassignedFocus = getUnassignedFocus()

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none overflow-hidden rounded-3xl bg-card"
    >
      <div
        className={cn(
          "absolute inset-0 origin-top-left select-none [&_button]:cursor-pointer",
          isPanning ? "cursor-grabbing" : "cursor-grab"
        )}
        style={{
          transform: `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        {layout && (
          <svg
            aria-hidden="true"
            width={size.width}
            height={size.height}
            className="pointer-events-none absolute inset-0"
          >
            {edges.map((edge) => {
              const focus = getEdgeFocus(edge)
              const styles = edgeStyles(focus)
              return (
                <g
                  key={edge.key}
                  style={{ opacity: styles.opacity, color: styles.stroke }}
                  className="transition-opacity duration-200 ease-out"
                >
                  <path
                    d={`M ${edge.start.x} ${edge.start.y} Q ${edge.control.x} ${edge.control.y} ${edge.end.x} ${edge.end.y}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={styles.strokeWidth}
                    strokeDasharray={styles.dashArray}
                    strokeLinecap="round"
                    className={cn(
                      "transition-[stroke-width] duration-200 ease-out",
                      focus !== "dim" && "edge-flow"
                    )}
                  />
                  <path
                    d={arrowPath(edge.end, edge.arrowAngle)}
                    fill="currentColor"
                    stroke="none"
                  />
                </g>
              )
            })}
          </svg>
        )}

        {layout &&
          projects.map((project) => {
            const position = layout.projectPositions.get(project.id)
            if (!position) return null
            const focus = getProjectFocus(project.id)

            return (
              <ProjectNode
                key={project.id}
                project={project}
                x={position.x}
                y={position.y}
                isSelected={project.id === selectedProjectId}
                focus={focus}
                onClick={() => onProjectClick(project.id)}
                onHoverChange={(hovered) =>
                  setHoveredNodeId((current) =>
                    hovered ? project.id : current === project.id ? null : current
                  )
                }
              />
            )
          })}

        {layout &&
          edges.map((edge) => {
            const focus = getEdgeFocus(edge)
            const isFocus = focus === "focus"
            const styles = edgeStyles(focus)
            return (
              <button
                key={`avatar-${edge.key}`}
                type="button"
                onClick={() => onEmployeeClick(edge.move.employee_id)}
                onMouseEnter={() => setHoveredEdgeKey(edge.key)}
                onMouseLeave={() =>
                  setHoveredEdgeKey((current) =>
                    current === edge.key ? null : current
                  )
                }
                onFocus={() => setHoveredEdgeKey(edge.key)}
                onBlur={() =>
                  setHoveredEdgeKey((current) =>
                    current === edge.key ? null : current
                  )
                }
                className={cn(
                  "absolute z-20 grid place-items-center rounded-full transition-[transform,opacity,box-shadow] duration-200 ease-out hover:scale-110 focus-visible:scale-110 focus-visible:outline-none",
                  isFocus && "scale-110"
                )}
                style={{
                  width: EDGE_AVATAR_SIZE,
                  height: EDGE_AVATAR_SIZE,
                  left: edge.mid.x - EDGE_AVATAR_SIZE / 2,
                  top: edge.mid.y - EDGE_AVATAR_SIZE / 2,
                  opacity: styles.avatarOpacity,
                  boxShadow: isFocus
                    ? "0 0 0 2px var(--pending-edge), 0 0 0 4px #ffffff, 0 6px 16px rgba(15, 23, 42, 0.18)"
                    : "0 0 0 1.5px var(--pending-edge), 0 0 0 3.5px #ffffff",
                }}
                aria-label={`Move request: ${edge.move.employee_name} to ${edge.move.to_project_name}`}
                title={`${edge.move.employee_name} → ${edge.move.to_project_name}`}
              >
                <InitialAvatar
                  name={edge.move.employee_name}
                  size={EDGE_AVATAR_SIZE - 4}
                />
              </button>
            )
          })}
      </div>

      <button
        type="button"
        onClick={onUnassignedClick}
        onMouseEnter={() => setHoveredNodeId("unassigned")}
        onMouseLeave={() =>
          setHoveredNodeId((current) =>
            current === "unassigned" ? null : current
          )
        }
        onFocus={() => setHoveredNodeId("unassigned")}
        onBlur={() =>
          setHoveredNodeId((current) =>
            current === "unassigned" ? null : current
          )
        }
        className={cn(
          "group absolute top-3 right-3 z-30 rounded-2xl border border-[#EF4444]/25 bg-[#EF4444]/10 px-3 py-2 text-left shadow-sm backdrop-blur transition-[transform,opacity,box-shadow] duration-200 ease-out hover:scale-[1.03] hover:bg-[#EF4444]/15 focus-visible:scale-[1.03] focus-visible:ring-2 focus-visible:ring-[#EF4444]/30 focus-visible:outline-none",
          unassignedFocus === "focus" && "scale-[1.03] shadow-md",
          unassignedFocus === "dim" && "opacity-55"
        )}
        style={{
          width: UNASSIGNED_WIDTH,
          height: UNASSIGNED_HEIGHT,
        }}
        aria-label={`Unassigned (${unassignedEmployees.length})`}
      >
        <span className="flex h-full flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#EF4444]">
            Unassigned
          </span>
          <span className="flex items-end justify-between gap-2">
            <span className="text-[10.5px] font-medium text-[#991B1B]/80">
              Bench
            </span>
            <span className="text-xl font-semibold tabular-nums text-[#991B1B]">
              {unassignedEmployees.length}
            </span>
          </span>
        </span>
      </button>

      <div className="absolute top-4 left-4 z-30 flex flex-col gap-1 rounded-2xl border border-border bg-background/90 p-1 shadow-sm backdrop-blur">
        <ZoomButton
          label="Zoom in"
          icon={ZoomInAreaIcon}
          onClick={handleZoomIn}
          disabled={zoom.scale >= MAX_SCALE}
        />
        <ZoomButton
          label="Zoom out"
          icon={ZoomOutAreaIcon}
          onClick={handleZoomOut}
          disabled={zoom.scale <= MIN_SCALE}
        />
        <ZoomButton
          label="Fit to view"
          icon={Maximize01Icon}
          onClick={handleFit}
        />
      </div>

      <div className="absolute bottom-3 right-3 z-30 flex max-w-[180px] flex-col gap-1.5 rounded-2xl border border-border bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/70">
            Legend
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <DashedLineIcon />
            <span>Move</span>
          </span>
          <span aria-hidden="true" className="h-3 w-px bg-border" />
          <LegendMiniItem color="#7C3AED" label="Phase" />
        </div>
      </div>
    </div>
  )
}

function ProjectNode({
  project,
  x,
  y,
  isSelected,
  focus,
  onClick,
  onHoverChange,
}: {
  project: Project
  x: number
  y: number
  isSelected: boolean
  focus: FocusLevel
  onClick: () => void
  onHoverChange: (hovered: boolean) => void
}) {
  const team = project.current_team_members
  const required = project.required_people_amount
  const state = getCapacityState(team.length, required)
  const diff = required > 0 ? team.length - required : 0
  const statusText =
    state === "under"
      ? `${Math.abs(diff)} open ${Math.abs(diff) === 1 ? "seat" : "seats"}`
      : state === "over"
        ? `${diff} overbooked`
        : capacityLabels[state]

  const isFocused = focus === "focus"
  const isRelated = focus === "related"
  const isDimmed = focus === "dim"

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
      aria-label={`${project.project_name}: ${team.length} of ${required} engineers`}
      className={cn(
        "absolute z-10 overflow-hidden rounded-[24px] border bg-card text-left shadow-sm transition-[transform,opacity,box-shadow,border-color] duration-200 ease-out hover:scale-[1.03] hover:shadow-md focus-visible:scale-[1.03] focus-visible:outline-none",
        isFocused
          ? "scale-[1.03] border-[color:var(--pending-edge)] shadow-md"
          : isRelated
            ? "border-[color:var(--pending-edge)]/45"
            : "border-border",
        isDimmed && "opacity-55",
        isSelected && "ring-2 ring-ring/30"
      )}
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        left: x - NODE_WIDTH / 2,
        top: y - NODE_HEIGHT / 2,
      }}
    >
      <span className="flex h-full min-w-0 flex-col justify-between gap-2 px-3 py-2">
        <span className="flex min-w-0 items-start justify-between gap-2">
          <span className="block min-w-0 flex-1 truncate text-[15.5px] font-semibold leading-tight text-foreground">
            {project.project_name}
          </span>

          <span className="shrink-0 text-right text-[11px] font-medium leading-none tabular-nums text-muted-foreground">
            <span className="block text-[17px] font-semibold leading-none text-foreground">
              {team.length}
              <span className="text-[12px] font-medium text-muted-foreground">
                /{required}
              </span>
            </span>
            seats
          </span>
        </span>

        <span className="flex min-w-0 flex-col items-start gap-1 pr-12">
          <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
            <span
              aria-hidden="true"
              className="inline-block size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: phaseDotColors[project.project_phase] }}
            />
            <span className="truncate">{phaseLabels[project.project_phase]}</span>
          </span>

          <span
            className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none"
            style={{
              borderColor: `${capacityColors[state]}55`,
              color: capacityColors[state],
              backgroundColor: `${capacityColors[state]}12`,
            }}
          >
            <span
              aria-hidden="true"
              className="inline-block size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: capacityColors[state] }}
            />
            <span className="truncate">{statusText}</span>
          </span>
        </span>
      </span>
    </button>
  )
}

function ZoomButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"]
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-9 cursor-pointer place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
    >
      <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" />
    </button>
  )
}

function DashedLineIcon() {
  return (
    <svg width="22" height="6" viewBox="0 0 22 6" aria-hidden="true">
      <line
        x1="1"
        y1="3"
        x2="21"
        y2="3"
        stroke="var(--pending-edge)"
        strokeWidth="1.8"
        strokeDasharray="5 4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LegendMiniItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  )
}

function edgeStyles(focus: FocusLevel) {
  switch (focus) {
    case "focus":
      return {
        stroke: "var(--pending-edge)",
        strokeWidth: 2.4,
        opacity: 1,
        dashArray: "6 4",
        avatarOpacity: 1,
      }
    case "related":
      return {
        stroke: "var(--pending-edge)",
        strokeWidth: 2,
        opacity: 0.85,
        dashArray: "5 4",
        avatarOpacity: 1,
      }
    case "dim":
      return {
        stroke: "#94A3B8",
        strokeWidth: 1.4,
        opacity: 0.18,
        dashArray: "5 4",
        avatarOpacity: 0.35,
      }
    case "idle":
    default:
      return {
        stroke: "var(--pending-edge)",
        strokeWidth: 1.7,
        opacity: 0.55,
        dashArray: "5 4",
        avatarOpacity: 0.92,
      }
  }
}

function arrowPath(end: Point, angleDeg: number): string {
  const angle = (angleDeg * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const baseCenterX = end.x - cos * ARROW_LENGTH
  const baseCenterY = end.y - sin * ARROW_LENGTH
  const leftX = baseCenterX + sin * ARROW_HALF_WIDTH
  const leftY = baseCenterY - cos * ARROW_HALF_WIDTH
  const rightX = baseCenterX - sin * ARROW_HALF_WIDTH
  const rightY = baseCenterY + cos * ARROW_HALF_WIDTH
  return `M ${end.x} ${end.y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`
}

function clipToBoxToward(node: Point, half: HalfSize, toward: Point): Point {
  const dx = toward.x - node.x
  const dy = toward.y - node.y
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax < 0.001 && ay < 0.001) return node
  const halfW = half.w + EDGE_END_PADDING
  const halfH = half.h + EDGE_END_PADDING
  const tx = ax > 0.001 ? halfW / ax : Number.POSITIVE_INFINITY
  const ty = ay > 0.001 ? halfH / ay : Number.POSITIVE_INFINITY
  const t = Math.min(tx, ty)
  return {
    x: node.x + dx * t,
    y: node.y + dy * t,
  }
}

function pickAvatarPoint(
  start: Point,
  control: Point,
  end: Point,
  layout: { projectPositions: Map<number, Point>; center: Point }
): Point {
  const candidates = [0.5, 0.42, 0.58, 0.36, 0.64, 0.3, 0.7]
  const blockedAreas = [
    ...Array.from(layout.projectPositions.values()).map((position) => ({
      x: position.x,
      y: position.y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    {
      x: layout.center.x,
      y: layout.center.y,
      width: HUB_SIZE + 16,
      height: HUB_SIZE + 16,
    },
  ]

  for (const t of candidates) {
    const point = quadraticPoint(start, control, end, t)
    if (!blockedAreas.some((area) => overlapsArea(point, area))) {
      return point
    }
  }

  return quadraticPoint(start, control, end, 0.5)
}

function quadraticPoint(start: Point, control: Point, end: Point, t: number): Point {
  const omt = 1 - t
  return {
    x: omt * omt * start.x + 2 * omt * t * control.x + t * t * end.x,
    y: omt * omt * start.y + 2 * omt * t * control.y + t * t * end.y,
  }
}

function overlapsArea(
  point: Point,
  area: { x: number; y: number; width: number; height: number }
) {
  const padding = EDGE_AVATAR_SIZE / 2 + 8
  return (
    point.x >= area.x - area.width / 2 - padding &&
    point.x <= area.x + area.width / 2 + padding &&
    point.y >= area.y - area.height / 2 - padding &&
    point.y <= area.y + area.height / 2 + padding
  )
}
