export type NodePosition = {
  x: number
  y: number
}

export type LayoutMode = "force" | "radial" | "hex"

const forceSpots: NodePosition[] = [
  { x: 0.18, y: 0.2 },
  { x: 0.5, y: 0.14 },
  { x: 0.82, y: 0.22 },
  { x: 0.12, y: 0.48 },
  { x: 0.88, y: 0.48 },
  { x: 0.22, y: 0.78 },
  { x: 0.52, y: 0.86 },
  { x: 0.8, y: 0.76 },
]

const hexSpots: NodePosition[] = [
  { x: 0.22, y: 0.22 },
  { x: 0.5, y: 0.18 },
  { x: 0.78, y: 0.22 },
  { x: 0.32, y: 0.5 },
  { x: 0.68, y: 0.5 },
  { x: 0.22, y: 0.82 },
  { x: 0.5, y: 0.86 },
  { x: 0.78, y: 0.82 },
]

type LayoutOptions = {
  mode?: LayoutMode
  padding?: number
  nodeSize?: number
  nodeWidth?: number
  nodeHeight?: number
  hubSize?: number
}

function projectNormalized(
  spots: NodePosition[],
  count: number,
  width: number,
  height: number,
  padding: number
): NodePosition[] {
  const safeWidth = Math.max(1, width - padding * 2)
  const safeHeight = Math.max(1, height - padding * 2)
  return Array.from({ length: count }, (_, index) => {
    const spot = spots[index % spots.length]
    return {
      x: padding + spot.x * safeWidth,
      y: padding + spot.y * safeHeight,
    }
  })
}

function radialPositions(
  count: number,
  width: number,
  height: number,
  padding: number,
  nodeSize: number,
  hubSize: number
): NodePosition[] {
  const cx = width / 2
  const cy = height / 2
  const fitX = cx - padding - nodeSize / 2
  const fitY = cy - padding - nodeSize / 2

  // Adjacent nodes on a horizontal ellipse are closest at the long-axis ends,
  // where their separation is approximately ry * (2π / count). The ideal ry is
  // the one that keeps that separation > nodeSize + small gap.
  const idealRy = (nodeSize + 18) / (2 * Math.sin(Math.PI / count))
  const minHubClearance = (hubSize + nodeSize) / 2 + 24

  // Hard cap at the card's fit area so nodes never overflow.
  const ry = Math.max(minHubClearance, Math.min(fitY, idealRy))
  // Stretch the x-axis to fill the card width; never taller than wide.
  const rx = Math.max(ry, fitX)

  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2
    return {
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    }
  })
}

function ellipsePositions(
  count: number,
  width: number,
  height: number,
  padding: number,
  nodeWidth: number,
  nodeHeight: number,
  hubSize: number
): NodePosition[] {
  const cx = width / 2
  const cy = height / 2
  const fitX = cx - padding - nodeWidth / 2
  const fitY = cy - padding - nodeHeight / 2
  const rx = Math.max(1, fitX)
  const idealRy = (nodeHeight + 42) / (2 * Math.sin(Math.PI / count))
  const ry = Math.max(
    (hubSize + nodeHeight) / 2 + 52,
    Math.min(fitY, idealRy)
  )
  const startAngle = -Math.PI / 2

  const positions = Array.from({ length: count }, (_, index) => {
    const angle = startAngle + (index / count) * Math.PI * 2
    return {
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    }
  })

  return relaxRectangles(positions, {
    width,
    height,
    padding,
    nodeWidth,
    nodeHeight,
    hubSize,
    center: { x: cx, y: cy },
  })
}

function balancedPositions(
  count: number,
  width: number,
  height: number,
  padding: number,
  nodeSize: number,
  hubSize: number
): NodePosition[] {
  const center = { x: width / 2, y: height / 2 }
  const safeWidth = Math.max(1, width - padding * 2)
  const safeHeight = Math.max(1, height - padding * 2)
  const columnCount = Math.min(
    count,
    Math.max(2, Math.floor(safeWidth / (nodeSize + 28)))
  )
  const rowCount = Math.max(1, Math.ceil(count / columnCount))
  const columnGap =
    columnCount === 1 ? 0 : Math.min(nodeSize + 52, safeWidth / (columnCount - 1))
  const xStart = center.x - (columnGap * (columnCount - 1)) / 2
  const yGap = Math.min(nodeSize + 42, safeHeight / Math.max(rowCount, 1))
  const hubClearance = (hubSize + nodeSize) / 2 + 18

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columnCount)
    const col = index % columnCount
    const columnsInRow = Math.min(columnCount, count - row * columnCount)
    const rowOffset = ((columnCount - columnsInRow) * columnGap) / 2
    const stagger = row % 2 === 1 ? columnGap * 0.18 : 0
    const x = clamp(
      xStart + col * columnGap + rowOffset + stagger,
      padding + nodeSize / 2,
      width - padding - nodeSize / 2
    )

    const rowDistance = (row - (rowCount - 1) / 2) * yGap
    const y =
      Math.abs(rowDistance) < hubClearance
        ? center.y + (rowDistance < 0 ? -hubClearance : hubClearance)
        : center.y + rowDistance

    return {
      x,
      y: clamp(y, padding + nodeSize / 2, height - padding - nodeSize / 2),
    }
  })
}

export function getNodeLayout(
  count: number,
  width: number,
  height: number,
  options: LayoutOptions = {}
): NodePosition[] {
  const {
    mode = "force",
    padding = 80,
    nodeSize = 124,
    nodeWidth = nodeSize,
    nodeHeight = nodeSize,
    hubSize = 86,
  } = options

  if (mode === "force" && count > forceSpots.length) {
    return ellipsePositions(
      count,
      width,
      height,
      padding,
      nodeWidth,
      nodeHeight,
      hubSize
    )
  }

  if (mode === "radial" ||
      (mode === "hex" && count > hexSpots.length)) {
    return radialPositions(count, width, height, padding, nodeSize, hubSize)
  }

  const spots = mode === "hex" ? hexSpots : forceSpots
  return projectNormalized(spots, count, width, height, padding)
}

export function getCenterPosition(width: number, height: number): NodePosition {
  return { x: width / 2, y: height / 2 }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function relaxRectangles(
  positions: NodePosition[],
  options: {
    width: number
    height: number
    padding: number
    nodeWidth: number
    nodeHeight: number
    hubSize: number
    center: NodePosition
  }
) {
  const gap = 18
  const halfWidth = options.nodeWidth / 2
  const halfHeight = options.nodeHeight / 2
  const minX = options.padding + halfWidth
  const maxX = options.width - options.padding - halfWidth
  const minY = options.padding + halfHeight
  const maxY = options.height - options.padding - halfHeight
  const hubClearanceX = options.hubSize / 2 + halfWidth + 28
  const hubClearanceY = options.hubSize / 2 + halfHeight + 28
  const relaxed = positions.map((position) => ({ ...position }))

  for (let iteration = 0; iteration < 48; iteration += 1) {
    for (let i = 0; i < relaxed.length; i += 1) {
      for (let j = i + 1; j < relaxed.length; j += 1) {
        const a = relaxed[i]
        const b = relaxed[j]
        const dx = b.x - a.x || 0.01
        const dy = b.y - a.y || 0.01
        const overlapX = options.nodeWidth + gap - Math.abs(dx)
        const overlapY = options.nodeHeight + gap - Math.abs(dy)

        if (overlapX <= 0 || overlapY <= 0) continue

        if (overlapX < overlapY) {
          const push = (overlapX / 2) * Math.sign(dx)
          a.x -= push
          b.x += push
        } else {
          const push = (overlapY / 2) * Math.sign(dy)
          a.y -= push
          b.y += push
        }
      }
    }

    relaxed.forEach((position) => {
      const dx = position.x - options.center.x || 0.01
      const dy = position.y - options.center.y || 0.01
      const overlapX = hubClearanceX - Math.abs(dx)
      const overlapY = hubClearanceY - Math.abs(dy)

      if (overlapX > 0 && overlapY > 0) {
        if (overlapX < overlapY) {
          position.x += overlapX * Math.sign(dx)
        } else {
          position.y += overlapY * Math.sign(dy)
        }
      }

      position.x = clamp(position.x, minX, maxX)
      position.y = clamp(position.y, minY, maxY)
    })
  }

  return relaxed
}
