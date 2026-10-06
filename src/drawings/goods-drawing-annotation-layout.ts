import { millimetres as mm } from '../engineering'
import type { DrawingPoint, DrawingText, TechnicalDrawingPrimitive } from './technical-drawing'

const point = (x: number, y: number): DrawingPoint => ({ x: mm(x), y: mm(y) })

/** Deterministic exterior annotation lanes, in the caller's model or paper units.
 * Geometry and dimension endpoints are read-only obstacles. Only labels and
 * their leaders are placed; the fixed-scale geometry transform is untouched.
 */
export function layoutGoodsDrawingAnnotations(
  source: readonly TechnicalDrawingPrimitive[],
  textSize: number,
): readonly TechnicalDrawingPrimitive[] {
  const primitives = source.map((entry): TechnicalDrawingPrimitive => {
    if (entry.kind !== 'dimension' || entry.dimensionStart.x !== entry.dimensionEnd.x) return entry
    const size = entry.textSizeMm ?? textSize
    const side = Math.sign(entry.dimensionStart.x - entry.start.x) || 1
    return { ...entry, labelPosition: point(entry.dimensionStart.x + side *
      (entry.label.length * size * 0.29 + size * 0.8), entry.labelPosition.y) }
  })
  const labels = primitives.filter((entry): entry is DrawingText => entry.kind === 'text')
  if (!labels.length) return primitives
  const points: DrawingPoint[] = []
  const dimensionTextBoxes: { minX: number; maxX: number; minY: number; maxY: number }[] = []
  for (const entry of primitives.filter((primitive) => primitive.layer === 'geometry' || primitive.kind === 'dimension')) {
    if ('start' in entry) points.push(entry.start, entry.end)
    if (entry.kind === 'rectangle' || entry.kind === 'component-outline' || entry.kind === 'hatch') {
      points.push(point(entry.x, entry.y), point(entry.x + entry.width, entry.y + entry.height))
    }
    if (entry.kind === 'circle' || entry.kind === 'arc') {
      points.push(point(entry.center.x - entry.radius, entry.center.y - entry.radius),
        point(entry.center.x + entry.radius, entry.center.y + entry.radius))
    }
    if (entry.kind === 'polyline') points.push(...entry.points)
    if (entry.kind === 'dimension') {
      const size = entry.textSizeMm ?? textSize
      const halfWidth = entry.label.length * size * 0.29
      dimensionTextBoxes.push({ minX: entry.labelPosition.x - halfWidth - size * 0.3,
        maxX: entry.labelPosition.x + halfWidth + size * 0.3,
        minY: entry.labelPosition.y - size * 1.2, maxY: entry.labelPosition.y + size * 0.6 })
      points.push(entry.dimensionStart, entry.dimensionEnd,
        point(entry.labelPosition.x - halfWidth, entry.labelPosition.y - size),
        point(entry.labelPosition.x + halfWidth, entry.labelPosition.y + size * 0.3))
    }
  }
  if (!points.length) return primitives
  const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x))
  const minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y))
  const gap = textSize * 0.8, rowHeight = textSize * 2
  const labelIds = new Set(labels.map((label) => label.id))
  const output = primitives.filter((entry) => entry.kind !== 'text' &&
    !labelIds.has(entry.id.replace(/-leader$/, '')))
  for (const side of ['left', 'right'] as const) {
    const requests = labels.filter((label) => (label.annotationSide ?? 'right') === side).map((label) => {
      const leader = primitives.find((entry) => entry.id === `${label.id}-leader`)
      const target = leader && 'start' in leader ? leader.start
        : leader?.kind === 'polyline' ? leader.points[0] : label.position
      return { label, target }
    }).sort((a, b) => a.target.y - b.target.y || a.label.id.localeCompare(b.label.id))
    let previousY = -Infinity
    const placed = requests.map(({ label, target }) => {
      const y = Math.max(target.y, minY + textSize, previousY + rowHeight)
      previousY = y
      return { label, target, y }
    })
    // Keep the stack within the existing vertical span whenever it has room.
    const overflow = placed.length ? Math.max(0, placed.at(-1)!.y + textSize * 0.3 - maxY) : 0
    const room = placed.length ? Math.max(0, placed[0].y - minY - textSize) : 0
    const shift = Math.min(overflow, room)
    for (const { label, target, y } of placed) {
      const baseline = y - shift
      const x = side === 'left' ? minX - gap : maxX + gap
      const elbowX = side === 'left' ? minX - gap / 2 : maxX + gap / 2
      // Route past dimension values rather than drawing a horizontal leader
      // through a depth/height label located at the same semantic elevation.
      const crossesDimensionText = (y: number) => dimensionTextBoxes.some((box) =>
        y >= box.minY && y <= box.maxY &&
        Math.min(target.x, elbowX) <= box.maxX && Math.max(target.x, elbowX) >= box.minX)
      let exitY: number = target.y
      for (let lane = 1; crossesDimensionText(exitY) && lane <= dimensionTextBoxes.length + 2; lane++) {
        exitY = target.y - lane * rowHeight
      }
      const textEndX = side === 'left' ? x + textSize * 0.3 : x - textSize * 0.3
      output.push({ id: `${label.id}-leader`, kind: 'polyline', role: 'secondary', layer: 'annotation',
        points: [target, point(target.x, exitY), point(elbowX, exitY), point(elbowX, baseline - textSize * 0.2),
          point(textEndX, baseline - textSize * 0.2)] })
      output.push({ ...label, position: point(x, baseline), anchor: side === 'left' ? 'end' : 'start', sizeMm: mm(textSize) })
    }
  }
  return output
}
