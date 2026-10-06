import type {
  DrawingArc,
  DrawingDimension,
  DrawingPoint,
  TechnicalDrawingDocument,
  TechnicalDrawingPrimitive,
  TechnicalLineRole,
} from '../drawings/technical-drawing'
import type { PreparedTechnicalPlanDxf, TechnicalPlanDxfCandidate } from './technical-plan-dxf'

export const TECHNICAL_DXF_VERSION = 'AC1009' as const

export const TECHNICAL_DXF_LAYERS = [
  'SHAFT',
  'CABIN',
  'CAR_FRAME',
  'GUIDE_RAILS',
  'COUNTERWEIGHT',
  'DOORS',
  'MACHINE',
  'BUFFERS',
  'ROPES',
  'DIMENSIONS',
  'CENTERLINES',
  'ANNOTATIONS',
  'LOADS',
  'VEHICLE',
  'APPROACH',
] as const

export type TechnicalDxfLayer = (typeof TECHNICAL_DXF_LAYERS)[number]
type DxfLineType = 'CONTINUOUS' | 'CENTER' | 'HIDDEN'

interface DxfLayerDefinition {
  readonly name: TechnicalDxfLayer
  readonly color: number
  readonly lineType: DxfLineType
}

interface DxfBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

interface DxfPlacement {
  readonly drawing: TechnicalPlanDxfCandidate
  readonly blockName: string
  readonly x: number
  readonly y: number
  readonly bounds: DxfBounds
}

const layerDefinitions: readonly DxfLayerDefinition[] = [
  { name: 'SHAFT', color: 7, lineType: 'CONTINUOUS' },
  { name: 'CABIN', color: 1, lineType: 'CONTINUOUS' },
  { name: 'CAR_FRAME', color: 3, lineType: 'CONTINUOUS' },
  { name: 'GUIDE_RAILS', color: 4, lineType: 'CONTINUOUS' },
  { name: 'COUNTERWEIGHT', color: 6, lineType: 'CONTINUOUS' },
  { name: 'DOORS', color: 2, lineType: 'CONTINUOUS' },
  { name: 'MACHINE', color: 5, lineType: 'CONTINUOUS' },
  { name: 'BUFFERS', color: 30, lineType: 'CONTINUOUS' },
  { name: 'ROPES', color: 8, lineType: 'HIDDEN' },
  { name: 'DIMENSIONS', color: 7, lineType: 'CONTINUOUS' },
  { name: 'CENTERLINES', color: 8, lineType: 'CENTER' },
  { name: 'ANNOTATIONS', color: 7, lineType: 'CONTINUOUS' },
  { name: 'LOADS', color: 30, lineType: 'CONTINUOUS' },
  { name: 'VEHICLE', color: 6, lineType: 'CONTINUOUS' },
  { name: 'APPROACH', color: 8, lineType: 'HIDDEN' },
]

const normalizeNumber = (value: number): string => {
  if (!Number.isFinite(value)) throw new Error('DXF coordinates must be finite')
  const normalized = Math.abs(value) < 1e-9 ? 0 : value
  return Number(normalized.toFixed(6)).toString()
}

/** R12 text is emitted as ASCII with readable German transliteration. */
export function toDxfAsciiText(value: string): string {
  return value
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/±/g, '+/-').replace(/[–—]/g, '-').replace(/·/g, '-')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/[\r\n]+/g, ' ')
}

class DxfWriter {
  private readonly lines: string[] = []

  pair(code: number, value: string | number) {
    this.lines.push(String(code), typeof value === 'number' ? normalizeNumber(value) : value)
  }

  comment(value: string) {
    this.pair(999, toDxfAsciiText(value))
  }

  toString(): string {
    return `${this.lines.join('\r\n')}\r\n`
  }
}

const point = (value: DrawingPoint): readonly [number, number] => [value.x, -value.y]

function primitiveKey(primitive: TechnicalDrawingPrimitive): string {
  const componentId = 'componentId' in primitive ? primitive.componentId ?? '' : ''
  return `${primitive.id} ${componentId}`.toLowerCase()
}

/** Assigns semantic CAD layers without changing or recreating drawing geometry. */
export function technicalDxfLayerForPrimitive(primitive: TechnicalDrawingPrimitive): TechnicalDxfLayer {
  if (primitive.kind === 'dimension' || primitive.role === 'dimension') return 'DIMENSIONS'
  const key = primitiveKey(primitive)
  // Envelope line patterns express visual hierarchy, not centerline ownership.
  if (primitive.layer === 'geometry' && ['goods-pallet', 'goods-roll-container', 'goods-forklift-envelope']
    .some((id) => key.includes(id))) return 'LOADS'
  if (primitive.kind === 'centerline' || primitive.role === 'centerline' || primitive.role === 'level') return 'CENTERLINES'
  if (primitive.layer === 'annotation') return 'ANNOTATIONS'

  if (key.includes('buffer')) return 'BUFFERS'
  if (key.includes('car-entry-approach') || key.includes('car-exit-approach') || key.includes('car-vehicle-sweep') ||
    key.includes('car-door-passage-envelope')) return 'APPROACH'
  if (key.includes('car-vehicle') || key.includes('car-wheel-contact')) return 'VEHICLE'
  if (key.includes('pallet') || key.includes('roll-container') || key.includes('forklift') || key.includes('load-envelope')) return 'LOADS'
  if (key.includes('rope') || key.includes('suspension')) return 'ROPES'
  if (key.includes('door') || key.includes('entrance') || key.includes('landing-') || key.includes('cabin-front') ||
    key.includes('cabin-rear') || key.includes('panel') || key.includes('jamb') || key.includes('sill') ||
    key.includes('operator') || key.includes('hanger')) return 'DOORS'
  if (key.includes('rail') || key.includes('shoe') || key.includes('goods-guide')) return 'GUIDE_RAILS'
  if (key.includes('counterweight')) return 'COUNTERWEIGHT'
  if (key.includes('car-frame') || key.includes('car-upright') || key.includes('car-crosshead') ||
    key.includes('car-lower') || key.includes('car-platform')) return 'CAR_FRAME'
  if (key.includes('machine') || key.includes('sheave') || key.includes('traction') || key.includes('governor') ||
    key.includes('tension')) return 'MACHINE'
  if (key.includes('shaft') || key === 'pit pit' || key.includes('headroom')) return 'SHAFT'
  if (key.includes('cabin')) return 'CABIN'
  if (key.includes('goods-platform')) return 'CABIN'
  return 'ANNOTATIONS'
}

function lineTypeForRole(role: TechnicalLineRole): DxfLineType {
  if (role === 'centerline' || role === 'level') return 'CENTER'
  if (role === 'hidden') return 'HIDDEN'
  return 'CONTINUOUS'
}

function entityHeader(writer: DxfWriter, type: string, layer: TechnicalDxfLayer, lineType: DxfLineType) {
  writer.pair(0, type)
  writer.pair(8, layer)
  writer.pair(6, lineType)
}

function writeLine(writer: DxfWriter, layer: TechnicalDxfLayer, lineType: DxfLineType,
  startX: number, startY: number, endX: number, endY: number) {
  entityHeader(writer, 'LINE', layer, lineType)
  writer.pair(10, startX); writer.pair(20, startY); writer.pair(30, 0)
  writer.pair(11, endX); writer.pair(21, endY); writer.pair(31, 0)
}

function writePolyline(writer: DxfWriter, layer: TechnicalDxfLayer, lineType: DxfLineType,
  points: readonly (readonly [number, number])[], closed: boolean) {
  entityHeader(writer, 'POLYLINE', layer, lineType)
  writer.pair(66, 1); writer.pair(70, closed ? 1 : 0)
  writer.pair(10, 0); writer.pair(20, 0); writer.pair(30, 0)
  for (const [x, y] of points) {
    writer.pair(0, 'VERTEX'); writer.pair(8, layer)
    writer.pair(10, x); writer.pair(20, y); writer.pair(30, 0)
  }
  writer.pair(0, 'SEQEND'); writer.pair(8, layer)
}

function writeRectangle(writer: DxfWriter, layer: TechnicalDxfLayer, lineType: DxfLineType,
  x: number, sourceY: number, width: number, height: number) {
  const y = -sourceY
  writePolyline(writer, layer, lineType, [
    [x, y], [x + width, y], [x + width, y - height], [x, y - height],
  ], true)
}

function writeText(writer: DxfWriter, layer: TechnicalDxfLayer, lineType: DxfLineType,
  x: number, y: number, value: string, height: number, anchor: 'start' | 'middle' | 'end' = 'start') {
  entityHeader(writer, 'TEXT', layer, lineType)
  writer.pair(10, x); writer.pair(20, y); writer.pair(30, 0)
  writer.pair(40, height); writer.pair(1, toDxfAsciiText(value)); writer.pair(7, 'STANDARD')
  if (anchor !== 'start') {
    writer.pair(72, anchor === 'middle' ? 1 : 2)
    writer.pair(11, x); writer.pair(21, y); writer.pair(31, 0)
  }
}

function writeDimensionArrow(writer: DxfWriter, tip: readonly [number, number], toward: readonly [number, number], size: number) {
  const dx = toward[0] - tip[0], dy = toward[1] - tip[1]
  const length = Math.hypot(dx, dy)
  if (length === 0) return
  const ux = dx / length, uy = dy / length, px = -uy, py = ux
  const backX = tip[0] + ux * size, backY = tip[1] + uy * size
  const half = size * 0.35
  writeLine(writer, 'DIMENSIONS', 'CONTINUOUS', tip[0], tip[1], backX + px * half, backY + py * half)
  writeLine(writer, 'DIMENSIONS', 'CONTINUOUS', tip[0], tip[1], backX - px * half, backY - py * half)
}

function writeDimension(writer: DxfWriter, primitive: DrawingDimension) {
  const start = point(primitive.start), end = point(primitive.end)
  const dimensionStart = point(primitive.dimensionStart), dimensionEnd = point(primitive.dimensionEnd)
  writeLine(writer, 'DIMENSIONS', 'CONTINUOUS', start[0], start[1], dimensionStart[0], dimensionStart[1])
  writeLine(writer, 'DIMENSIONS', 'CONTINUOUS', end[0], end[1], dimensionEnd[0], dimensionEnd[1])
  writeLine(writer, 'DIMENSIONS', 'CONTINUOUS', dimensionStart[0], dimensionStart[1], dimensionEnd[0], dimensionEnd[1])
  const arrowSize = Number(primitive.textSizeMm ?? 100) * 0.6
  writeDimensionArrow(writer, dimensionStart, dimensionEnd, arrowSize)
  writeDimensionArrow(writer, dimensionEnd, dimensionStart, arrowSize)
  const label = point(primitive.labelPosition)
  writeText(writer, 'DIMENSIONS', 'CONTINUOUS', label[0], label[1], primitive.label,
    Number(primitive.textSizeMm ?? 100), 'middle')
}

function normalizedDegrees(radians: number): number {
  const degrees = radians * 180 / Math.PI
  return ((degrees % 360) + 360) % 360
}

function reflectedArcAngles(arc: DrawingArc): readonly [number, number] {
  const reflectedStart = -arc.startAngleRad
  const reflectedEnd = -arc.endAngleRad
  return arc.endAngleRad - arc.startAngleRad >= 0
    ? [normalizedDegrees(reflectedEnd), normalizedDegrees(reflectedStart)]
    : [normalizedDegrees(reflectedStart), normalizedDegrees(reflectedEnd)]
}

function writePrimitive(writer: DxfWriter, primitive: TechnicalDrawingPrimitive) {
  const layer = technicalDxfLayerForPrimitive(primitive)
  const lineType = lineTypeForRole(primitive.role)
  writer.comment(`Primitive: ${primitive.id}`)
  switch (primitive.kind) {
    case 'line':
    case 'centerline':
    case 'extension-line': {
      const start = point(primitive.start), end = point(primitive.end)
      writeLine(writer, layer, lineType, start[0], start[1], end[0], end[1])
      return
    }
    case 'polyline':
      writePolyline(writer, layer, lineType, primitive.points.map(point), primitive.closed === true)
      return
    case 'rectangle':
    case 'component-outline':
    case 'hatch':
      writeRectangle(writer, layer, lineType, primitive.x, primitive.y, primitive.width, primitive.height)
      return
    case 'circle': {
      const center = point(primitive.center)
      entityHeader(writer, 'CIRCLE', layer, lineType)
      writer.pair(10, center[0]); writer.pair(20, center[1]); writer.pair(30, 0); writer.pair(40, primitive.radius)
      return
    }
    case 'arc': {
      const center = point(primitive.center)
      const [startAngle, endAngle] = reflectedArcAngles(primitive)
      entityHeader(writer, 'ARC', layer, lineType)
      writer.pair(10, center[0]); writer.pair(20, center[1]); writer.pair(30, 0); writer.pair(40, primitive.radius)
      writer.pair(50, startAngle); writer.pair(51, endAngle)
      return
    }
    case 'text': {
      const position = point(primitive.position)
      writeText(writer, layer, lineType, position[0], position[1], primitive.text,
        Number(primitive.sizeMm ?? 110), primitive.anchor)
      return
    }
    case 'dimension':
      writeDimension(writer, primitive)
      return
    case 'section-marker': {
      const start = point(primitive.start), end = point(primitive.end)
      writeLine(writer, layer, lineType, start[0], start[1], end[0], end[1])
      writeText(writer, 'ANNOTATIONS', 'CONTINUOUS', end[0], end[1], primitive.label, 110)
    }
  }
}

function writeDocumentEntities(writer: DxfWriter, document: TechnicalDrawingDocument) {
  for (const primitive of document.primitives) writePrimitive(writer, primitive)
}

function dxfBounds(document: TechnicalDrawingDocument): DxfBounds {
  return {
    minX: document.fittedBounds.minX,
    minY: -document.fittedBounds.maxY,
    maxX: document.fittedBounds.maxX,
    maxY: -document.fittedBounds.minY,
  }
}

function createPlacements(drawings: readonly TechnicalPlanDxfCandidate[]): readonly DxfPlacement[] {
  let cursorX = 0
  return drawings.map((drawing, index) => {
    const bounds = dxfBounds(drawing.document)
    const x = cursorX - bounds.minX
    const y = -bounds.minY
    cursorX += bounds.maxX - bounds.minX + 2000
    return {
      drawing,
      blockName: drawing.document.view === 'plan' ? 'LP_GRUNDRISS'
        : drawing.document.view === 'section' ? 'LP_SCHNITT'
          : `LP_TUERANSICHT_${String(index + 1).padStart(3, '0')}`,
      x,
      y,
      bounds: {
        minX: bounds.minX + x, minY: bounds.minY + y,
        maxX: bounds.maxX + x, maxY: bounds.maxY + y,
      },
    }
  })
}

function unionBounds(bounds: readonly DxfBounds[]): DxfBounds {
  if (!bounds.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  return {
    minX: Math.min(...bounds.map((entry) => entry.minX)),
    minY: Math.min(...bounds.map((entry) => entry.minY)),
    maxX: Math.max(...bounds.map((entry) => entry.maxX)),
    maxY: Math.max(...bounds.map((entry) => entry.maxY)),
  }
}

function writeHeader(writer: DxfWriter, bounds: DxfBounds, prepared: PreparedTechnicalPlanDxf) {
  writer.comment('LiftPlan technical drawing export')
  writer.comment('Planning representation without proof of technical or regulatory conformity')
  writer.comment(`Project: ${prepared.drawings[0]?.metadata.projectName ?? ''}`)
  writer.comment(`Project ID: ${prepared.drawings[0]?.metadata.projectId ?? ''}`)
  writer.comment(`LiftPlan version: ${prepared.drawings[0]?.metadata.version ?? ''}`)
  writer.comment(`Export date: ${prepared.drawings[0]?.metadata.exportDate ?? ''}`)
  writer.comment('Model-space unit: millimetres')
  writer.comment(`Drawing set: ${prepared.drawings.map((entry) => entry.metadata.drawingType).join(', ')}`)
  writer.pair(0, 'SECTION'); writer.pair(2, 'HEADER')
  writer.pair(9, '$ACADVER'); writer.pair(1, TECHNICAL_DXF_VERSION)
  writer.pair(9, '$DWGCODEPAGE'); writer.pair(3, 'ANSI_1252')
  writer.pair(9, '$LUNITS'); writer.pair(70, 2)
  writer.pair(9, '$LUPREC'); writer.pair(70, 4)
  writer.pair(9, '$MEASUREMENT'); writer.pair(70, 1)
  writer.pair(9, '$EXTMIN'); writer.pair(10, bounds.minX); writer.pair(20, bounds.minY); writer.pair(30, 0)
  writer.pair(9, '$EXTMAX'); writer.pair(10, bounds.maxX); writer.pair(20, bounds.maxY); writer.pair(30, 0)
  writer.pair(0, 'ENDSEC')
}

function writeLineType(writer: DxfWriter, name: DxfLineType, description: string, segments: readonly number[]) {
  writer.pair(0, 'LTYPE'); writer.pair(2, name); writer.pair(70, 0); writer.pair(3, description)
  writer.pair(72, 65); writer.pair(73, segments.length)
  writer.pair(40, segments.reduce((sum, segment) => sum + Math.abs(segment), 0))
  for (const segment of segments) writer.pair(49, segment)
}

function writeTables(writer: DxfWriter) {
  writer.pair(0, 'SECTION'); writer.pair(2, 'TABLES')
  writer.pair(0, 'TABLE'); writer.pair(2, 'LTYPE'); writer.pair(70, 3)
  writeLineType(writer, 'CONTINUOUS', 'Solid line', [])
  writeLineType(writer, 'CENTER', 'Center ____ _ ____ _ ____', [100, -25, 25, -25])
  writeLineType(writer, 'HIDDEN', 'Hidden __ __ __ __', [75, -25])
  writer.pair(0, 'ENDTAB')

  writer.pair(0, 'TABLE'); writer.pair(2, 'LAYER'); writer.pair(70, layerDefinitions.length + 1)
  writer.pair(0, 'LAYER'); writer.pair(2, '0'); writer.pair(70, 0); writer.pair(62, 7); writer.pair(6, 'CONTINUOUS')
  for (const layer of layerDefinitions) {
    writer.pair(0, 'LAYER'); writer.pair(2, layer.name); writer.pair(70, 0)
    writer.pair(62, layer.color); writer.pair(6, layer.lineType)
  }
  writer.pair(0, 'ENDTAB')

  writer.pair(0, 'TABLE'); writer.pair(2, 'STYLE'); writer.pair(70, 1)
  writer.pair(0, 'STYLE'); writer.pair(2, 'STANDARD'); writer.pair(70, 0)
  writer.pair(40, 0); writer.pair(41, 1); writer.pair(50, 0); writer.pair(71, 0); writer.pair(42, 100)
  writer.pair(3, 'txt'); writer.pair(4, '')
  writer.pair(0, 'ENDTAB')
  writer.pair(0, 'ENDSEC')
}

function writeBaseBlock(writer: DxfWriter, name: string) {
  writer.pair(0, 'BLOCK'); writer.pair(8, '0'); writer.pair(2, name); writer.pair(70, 0)
  writer.pair(10, 0); writer.pair(20, 0); writer.pair(30, 0); writer.pair(3, name); writer.pair(1, '')
  writer.pair(0, 'ENDBLK'); writer.pair(8, '0')
}

function writeBlocks(writer: DxfWriter, placements: readonly DxfPlacement[]) {
  writer.pair(0, 'SECTION'); writer.pair(2, 'BLOCKS')
  writeBaseBlock(writer, '*MODEL_SPACE')
  writeBaseBlock(writer, '*PAPER_SPACE')
  for (const placement of placements) {
    writer.pair(0, 'BLOCK'); writer.pair(8, '0'); writer.pair(2, placement.blockName); writer.pair(70, 0)
    writer.pair(10, 0); writer.pair(20, 0); writer.pair(30, 0); writer.pair(3, placement.blockName); writer.pair(1, '')
    writer.comment(`Drawing: ${placement.drawing.metadata.drawingType}`)
    if (placement.drawing.metadata.doorSelection) {
      writer.comment(`Landing: ${placement.drawing.metadata.doorSelection.landing}`)
      writer.comment(`Entrance: ${placement.drawing.metadata.doorSelection.sideLabel}`)
    }
    writeDocumentEntities(writer, placement.drawing.document)
    writer.pair(0, 'ENDBLK'); writer.pair(8, '0')
  }
  writer.pair(0, 'ENDSEC')
}

function writeEntities(writer: DxfWriter, prepared: PreparedTechnicalPlanDxf, placements: readonly DxfPlacement[]) {
  writer.pair(0, 'SECTION'); writer.pair(2, 'ENTITIES')
  if (prepared.scope === 'current') {
    const current = prepared.drawings[0]
    if (current) writeDocumentEntities(writer, current.document)
  } else {
    for (const placement of placements) {
      writer.comment(`Insert: ${placement.drawing.metadata.drawingType}`)
      writer.pair(0, 'INSERT'); writer.pair(8, 'ANNOTATIONS'); writer.pair(2, placement.blockName)
      writer.pair(10, placement.x); writer.pair(20, placement.y); writer.pair(30, 0)
    }
  }
  writer.pair(0, 'ENDSEC')
}

/** Serializes normalized model-space drawing primitives directly to ASCII DXF R12. */
export function generateTechnicalPlanDxf(prepared: PreparedTechnicalPlanDxf): string {
  const placements = prepared.scope === 'plan-set' ? createPlacements(prepared.drawings) : []
  const bounds = prepared.scope === 'plan-set'
    ? unionBounds(placements.map((entry) => entry.bounds))
    : dxfBounds(prepared.drawings[0].document)
  const writer = new DxfWriter()
  writeHeader(writer, bounds, prepared)
  writeTables(writer)
  writeBlocks(writer, placements)
  writeEntities(writer, prepared, placements)
  writer.pair(0, 'EOF')
  return writer.toString()
}

export function downloadTechnicalPlanDxf(content: string, filename: string) {
  if (!content.trim()) throw new Error('Generated DXF is empty')
  const blob = new Blob([content], { type: 'application/dxf;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
