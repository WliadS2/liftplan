import { millimetres, type Millimetres } from '../engineering'

export const TECHNICAL_DRAWING_SCALES = ['auto', '1:20', '1:25', '1:50', '1:100'] as const
export type TechnicalDrawingScale = (typeof TECHNICAL_DRAWING_SCALES)[number]
export type TechnicalDrawingView = 'plan' | 'section' | 'door-elevation'
export type TechnicalDrawingDetail = 'planning' | 'simplified'
export type TechnicalLineRole = 'cut' | 'visible' | 'secondary' | 'centerline' | 'hidden' |
  'dimension' | 'level' | 'section'
export type TechnicalDrawingStatus = 'complete' | 'incomplete' | 'conflict'

export const TECHNICAL_A4_PAGE_SIZE_MM = {
  portrait: { width: 210, height: 297 },
  landscape: { width: 297, height: 210 },
} as const

export interface CadLineStyle {
  readonly weightMm: number
  readonly pattern: 'solid' | 'dashed' | 'dash-dot'
}

export const CAD_LINE_STYLES: Readonly<Record<TechnicalLineRole, CadLineStyle>> = {
  cut: { weightMm: 0.7, pattern: 'solid' },
  visible: { weightMm: 0.45, pattern: 'solid' },
  secondary: { weightMm: 0.25, pattern: 'solid' },
  dimension: { weightMm: 0.18, pattern: 'solid' },
  centerline: { weightMm: 0.18, pattern: 'dash-dot' },
  hidden: { weightMm: 0.18, pattern: 'dashed' },
  level: { weightMm: 0.22, pattern: 'dash-dot' },
  section: { weightMm: 0.7, pattern: 'solid' },
}

export interface DrawingPoint {
  readonly x: Millimetres
  readonly y: Millimetres
}

export interface DrawingBounds {
  readonly minX: Millimetres
  readonly minY: Millimetres
  readonly maxX: Millimetres
  readonly maxY: Millimetres
}

interface DrawingPrimitiveBase {
  readonly id: string
  readonly role: TechnicalLineRole
  readonly layer: 'geometry' | 'annotation'
}

export interface DrawingLine extends DrawingPrimitiveBase {
  readonly kind: 'line' | 'centerline' | 'extension-line'
  readonly start: DrawingPoint
  readonly end: DrawingPoint
}

export interface DrawingPolyline extends DrawingPrimitiveBase {
  readonly kind: 'polyline'
  readonly points: readonly DrawingPoint[]
  readonly closed?: boolean
}

export interface DrawingRectangle extends DrawingPrimitiveBase {
  readonly kind: 'rectangle' | 'component-outline'
  readonly x: Millimetres
  readonly y: Millimetres
  readonly width: Millimetres
  readonly height: Millimetres
  readonly componentId?: string
}

export interface DrawingHatch extends DrawingPrimitiveBase {
  readonly kind: 'hatch'
  readonly x: Millimetres
  readonly y: Millimetres
  readonly width: Millimetres
  readonly height: Millimetres
  readonly pattern: 'section-structure'
}

export interface DrawingCircle extends DrawingPrimitiveBase {
  readonly kind: 'circle'
  readonly center: DrawingPoint
  readonly radius: Millimetres
}

export interface DrawingArc extends DrawingPrimitiveBase {
  readonly kind: 'arc'
  readonly center: DrawingPoint
  readonly radius: Millimetres
  readonly startAngleRad: number
  readonly endAngleRad: number
}

export interface DrawingText extends DrawingPrimitiveBase {
  readonly kind: 'text'
  readonly position: DrawingPoint
  readonly text: string
  readonly anchor?: 'start' | 'middle' | 'end'
  readonly sizeMm?: Millimetres
}

export interface DrawingAnnotationOptions {
  readonly anchor?: DrawingText['anchor']
  readonly sizeMm?: Millimetres
  readonly leader?: boolean
}

export interface DrawingDimension extends DrawingPrimitiveBase {
  readonly kind: 'dimension'
  readonly semantic: string
  readonly valueMm: Millimetres
  readonly label: string
  readonly start: DrawingPoint
  readonly end: DrawingPoint
  readonly dimensionStart: DrawingPoint
  readonly dimensionEnd: DrawingPoint
  readonly labelPosition: DrawingPoint
  readonly textSizeMm?: Millimetres
}

export interface DrawingSectionMarker extends DrawingPrimitiveBase {
  readonly kind: 'section-marker'
  readonly start: DrawingPoint
  readonly end: DrawingPoint
  readonly label: string
}

export type TechnicalDrawingPrimitive = DrawingLine | DrawingPolyline | DrawingRectangle | DrawingCircle |
  DrawingArc | DrawingText | DrawingDimension | DrawingSectionMarker | DrawingHatch

export interface TechnicalDrawingPage {
  readonly format: 'A4'
  readonly orientation: 'portrait' | 'landscape'
  readonly widthMm: Millimetres
  readonly heightMm: Millimetres
  readonly marginMm: Millimetres
  readonly titleBlockReserveMm: Millimetres
  readonly contentBounds: DrawingBounds
}

export interface TechnicalDrawingDocument {
  readonly id: string
  readonly title: string
  readonly view: TechnicalDrawingView
  readonly status: TechnicalDrawingStatus
  readonly incompleteMessage?: string
  readonly coordinateSystem: string
  readonly scale: {
    readonly requested: TechnicalDrawingScale
    readonly previewMode: 'automatic-fit' | 'fixed-page'
    readonly printAccuracy: false
    readonly denominator?: 20 | 25 | 50 | 100
    readonly detail: TechnicalDrawingDetail
  }
  readonly primitives: readonly TechnicalDrawingPrimitive[]
  readonly geometryBounds: DrawingBounds
  readonly annotationBounds: DrawingBounds
  readonly fittedBounds: DrawingBounds
}

const point = (x: number, y: number): DrawingPoint => ({ x: millimetres(x), y: millimetres(y) })
const emptyBounds = (): DrawingBounds => ({ minX: millimetres(0), minY: millimetres(0), maxX: millimetres(0), maxY: millimetres(0) })

export function drawingBoundsFromPoints(points: readonly DrawingPoint[]): DrawingBounds {
  if (!points.length) return emptyBounds()
  return {
    minX: millimetres(Math.min(...points.map((entry) => entry.x))),
    minY: millimetres(Math.min(...points.map((entry) => entry.y))),
    maxX: millimetres(Math.max(...points.map((entry) => entry.x))),
    maxY: millimetres(Math.max(...points.map((entry) => entry.y))),
  }
}

export function unionDrawingBounds(bounds: readonly DrawingBounds[]): DrawingBounds {
  if (!bounds.length) return emptyBounds()
  return {
    minX: millimetres(Math.min(...bounds.map((entry) => entry.minX))),
    minY: millimetres(Math.min(...bounds.map((entry) => entry.minY))),
    maxX: millimetres(Math.max(...bounds.map((entry) => entry.maxX))),
    maxY: millimetres(Math.max(...bounds.map((entry) => entry.maxY))),
  }
}

export function expandDrawingBounds(bounds: DrawingBounds, marginMm: Millimetres): DrawingBounds {
  return {
    minX: millimetres(bounds.minX - marginMm), minY: millimetres(bounds.minY - marginMm),
    maxX: millimetres(bounds.maxX + marginMm), maxY: millimetres(bounds.maxY + marginMm),
  }
}

function primitiveBounds(primitive: TechnicalDrawingPrimitive): DrawingBounds {
  if (primitive.kind === 'rectangle' || primitive.kind === 'component-outline' || primitive.kind === 'hatch') {
    return drawingBoundsFromPoints([point(primitive.x, primitive.y), point(primitive.x + primitive.width, primitive.y + primitive.height)])
  }
  if (primitive.kind === 'circle' || primitive.kind === 'arc') {
    return drawingBoundsFromPoints([
      point(primitive.center.x - primitive.radius, primitive.center.y - primitive.radius),
      point(primitive.center.x + primitive.radius, primitive.center.y + primitive.radius),
    ])
  }
  if (primitive.kind === 'polyline') return drawingBoundsFromPoints(primitive.points)
  if (primitive.kind === 'text') {
    const size = primitive.sizeMm ?? millimetres(110)
    const width = primitive.text.length * size * 0.58
    const left = primitive.anchor === 'middle' ? primitive.position.x - width / 2 : primitive.anchor === 'end' ? primitive.position.x - width : primitive.position.x
    return drawingBoundsFromPoints([point(left, primitive.position.y - size), point(left + width, primitive.position.y + size * 0.25)])
  }
  if (primitive.kind === 'dimension') {
    const size = primitive.textSizeMm ?? millimetres(100)
    return drawingBoundsFromPoints([
      primitive.start, primitive.end, primitive.dimensionStart, primitive.dimensionEnd,
      point(primitive.labelPosition.x - primitive.label.length * size * 0.29, primitive.labelPosition.y - size * 0.9),
      point(primitive.labelPosition.x + primitive.label.length * size * 0.29, primitive.labelPosition.y + size * 0.3),
    ])
  }
  if ('start' in primitive && 'end' in primitive) return drawingBoundsFromPoints([primitive.start, primitive.end])
  return emptyBounds()
}

export function calculateDrawingBounds(primitives: readonly TechnicalDrawingPrimitive[], layer?: TechnicalDrawingPrimitive['layer']): DrawingBounds {
  const selected = layer ? primitives.filter((primitive) => primitive.layer === layer) : primitives
  return unionDrawingBounds(selected.map(primitiveBounds))
}

export function createTechnicalDrawingDocument(input: Omit<TechnicalDrawingDocument,
  'geometryBounds' | 'annotationBounds' | 'fittedBounds'>): TechnicalDrawingDocument {
  const geometryBounds = calculateDrawingBounds(input.primitives, 'geometry')
  const annotationBounds = calculateDrawingBounds(input.primitives, 'annotation')
  const fittedBounds = expandDrawingBounds(unionDrawingBounds([geometryBounds, annotationBounds]), millimetres(120))
  return { ...input, geometryBounds, annotationBounds, fittedBounds }
}

export function horizontalDimension(id: string, semantic: string, x1: number, x2: number, geometryY: number,
  dimensionY: number, valueMm: Millimetres, textSizeMm?: Millimetres): DrawingDimension {
  const label = `${Number(valueMm.toFixed(1))} mm`
  return {
    id, kind: 'dimension', role: 'dimension', layer: 'annotation', semantic, valueMm, label,
    start: point(x1, geometryY), end: point(x2, geometryY),
    dimensionStart: point(x1, dimensionY), dimensionEnd: point(x2, dimensionY),
    labelPosition: point((x1 + x2) / 2, dimensionY - 55),
    textSizeMm,
  }
}

export function verticalDimension(id: string, semantic: string, y1: number, y2: number, geometryX: number,
  dimensionX: number, valueMm: Millimetres, textSizeMm?: Millimetres): DrawingDimension {
  const label = `${Number(valueMm.toFixed(1))} mm`
  return {
    id, kind: 'dimension', role: 'dimension', layer: 'annotation', semantic, valueMm, label,
    start: point(geometryX, y1), end: point(geometryX, y2),
    dimensionStart: point(dimensionX, y1), dimensionEnd: point(dimensionX, y2),
    labelPosition: point(dimensionX + 55, (y1 + y2) / 2),
    textSizeMm,
  }
}

/**
 * Places a component label at an explicit annotation offset. The optional
 * leader keeps the semantic target separate from the text position without
 * requiring the SVG renderer to infer layout from geometry.
 */
export function componentAnnotation(
  id: string,
  label: string,
  target: DrawingPoint,
  position: DrawingPoint,
  options: DrawingAnnotationOptions = {},
): readonly TechnicalDrawingPrimitive[] {
  const anchor = options.anchor ?? 'middle'
  const primitives: TechnicalDrawingPrimitive[] = []

  if (options.leader !== false) {
    const leaderEndX = anchor === 'start'
      ? position.x - 35
      : anchor === 'end'
        ? position.x + 35
        : position.x
    primitives.push({
      id: `${id}-leader`,
      kind: 'line',
      role: 'secondary',
      layer: 'annotation',
      start: target,
      end: point(leaderEndX, position.y),
    })
  }

  primitives.push({
    id,
    kind: 'text',
    role: 'secondary',
    layer: 'annotation',
    position,
    text: label,
    anchor,
    sizeMm: options.sizeMm,
  })

  return primitives
}

export function technicalDrawingDetail(scale: TechnicalDrawingScale): TechnicalDrawingDetail {
  return scale === '1:100' ? 'simplified' : 'planning'
}

export interface TechnicalDrawingPresentation {
  readonly mode: 'automatic-fit' | 'fixed-page'
  readonly primitives: readonly TechnicalDrawingPrimitive[]
  readonly viewBounds: DrawingBounds
  readonly page?: TechnicalDrawingPage
  readonly geometryBounds: DrawingBounds
  readonly annotationBounds: DrawingBounds
  readonly completeBounds: DrawingBounds
  readonly fit?: 'fits' | 'does-not-fit'
}

export const technicalDrawingScaleDenominator = (scale: TechnicalDrawingScale): 20 | 25 | 50 | 100 | undefined => {
  if (scale === 'auto') return undefined
  return Number(scale.slice(2)) as 20 | 25 | 50 | 100
}

function dimensionPaperOffset(semantic: string): number {
  if (semantic === 'door-width' || semantic === 'door-height') return 8
  if (semantic.startsWith('cabin-')) return 13
  if (semantic.startsWith('shaft-') || semantic === 'installation-height') return 18
  if (semantic === 'pit-depth' || semantic === 'headroom') return 12
  return 9
}

/**
 * Converts model-space millimetres to a deterministic A4 paper-space preview.
 * Engineering geometry is scaled by 1:N while text, leaders, line weights, and
 * dimension lanes remain stable paper-space annotations.
 */
export function createTechnicalDrawingPresentation(
  document: TechnicalDrawingDocument,
): TechnicalDrawingPresentation {
  const denominator = technicalDrawingScaleDenominator(document.scale.requested)
  if (!denominator) {
    return {
      mode: 'automatic-fit', primitives: document.primitives, viewBounds: document.fittedBounds,
      geometryBounds: document.geometryBounds, annotationBounds: document.annotationBounds,
      completeBounds: calculateDrawingBounds(document.primitives),
    }
  }

  const portrait = document.view === 'section'
  const pageSize = TECHNICAL_A4_PAGE_SIZE_MM[portrait ? 'portrait' : 'landscape']
  const pageWidth = pageSize.width
  const pageHeight = pageSize.height
  const margin = 12
  const titleBlockReserve = 18
  const contentBounds: DrawingBounds = {
    minX: millimetres(margin), minY: millimetres(margin),
    maxX: millimetres(pageWidth - margin), maxY: millimetres(pageHeight - margin - titleBlockReserve),
  }
  const printableCenterX = pageWidth / 2
  const printableCenterY = (pageHeight - titleBlockReserve) / 2
  const modelCenterX = (document.geometryBounds.minX + document.geometryBounds.maxX) / 2
  const modelCenterY = (document.geometryBounds.minY + document.geometryBounds.maxY) / 2
  const transformPoint = (value: DrawingPoint): DrawingPoint => point(
    printableCenterX + (value.x - modelCenterX) / denominator,
    printableCenterY + (value.y - modelCenterY) / denominator,
  )
  const textSize = millimetres(document.scale.detail === 'simplified' ? 2.2 : 2.5)
  const leaderLabels = new Map(document.primitives
    .filter((entry): entry is DrawingText => entry.kind === 'text')
    .map((entry) => [entry.id, entry]))

  const transformed = document.primitives.map((primitive): TechnicalDrawingPrimitive => {
    if (primitive.kind === 'rectangle' || primitive.kind === 'component-outline' || primitive.kind === 'hatch') {
      const topLeft = transformPoint(point(primitive.x, primitive.y))
      return { ...primitive, x: topLeft.x, y: topLeft.y,
        width: millimetres(primitive.width / denominator), height: millimetres(primitive.height / denominator) }
    }
    if (primitive.kind === 'circle' || primitive.kind === 'arc') {
      return { ...primitive, center: transformPoint(primitive.center), radius: millimetres(primitive.radius / denominator) }
    }
    if (primitive.kind === 'polyline') {
      return { ...primitive, points: primitive.points.map(transformPoint) }
    }
    if (primitive.kind === 'dimension') {
      const start = transformPoint(primitive.start), end = transformPoint(primitive.end)
      const horizontal = Math.abs(primitive.start.x - primitive.end.x) >= Math.abs(primitive.start.y - primitive.end.y)
      const sourceOffset = horizontal
        ? primitive.dimensionStart.y - primitive.start.y
        : primitive.dimensionStart.x - primitive.start.x
      const offset = Math.sign(sourceOffset || 1) * dimensionPaperOffset(primitive.semantic)
      const dimensionStart = horizontal ? point(start.x, start.y + offset) : point(start.x + offset, start.y)
      const dimensionEnd = horizontal ? point(end.x, end.y + offset) : point(end.x + offset, end.y)
      return { ...primitive, start, end, dimensionStart, dimensionEnd,
        labelPosition: horizontal
          ? point((dimensionStart.x + dimensionEnd.x) / 2, dimensionStart.y - 1.8)
          : point(dimensionStart.x + 1.8, (dimensionStart.y + dimensionEnd.y) / 2),
        textSizeMm: textSize }
    }
    if (primitive.kind === 'text') {
      const leader = document.primitives.find((entry): entry is DrawingLine =>
        entry.kind === 'line' && entry.id === `${primitive.id}-leader`)
      if (!leader) return { ...primitive, position: transformPoint(primitive.position), sizeMm: textSize }
      const target = transformPoint(leader.start)
      const dx = primitive.position.x - leader.start.x, dy = primitive.position.y - leader.start.y
      const length = Math.hypot(dx, dy) || 1
      const distance = document.scale.detail === 'simplified' ? 7 : 9
      return { ...primitive, position: point(target.x + dx / length * distance, target.y + dy / length * distance), sizeMm: textSize }
    }
    if ((primitive.kind === 'line' || primitive.kind === 'centerline' || primitive.kind === 'extension-line') &&
      primitive.id.endsWith('-leader')) {
      const label = leaderLabels.get(primitive.id.slice(0, -'-leader'.length))
      if (label) {
        const target = transformPoint(primitive.start)
        const dx = label.position.x - primitive.start.x, dy = label.position.y - primitive.start.y
        const length = Math.hypot(dx, dy) || 1
        const distance = document.scale.detail === 'simplified' ? 6 : 8
        return { ...primitive, start: target, end: point(target.x + dx / length * distance, target.y + dy / length * distance) }
      }
    }
    if ('start' in primitive && 'end' in primitive) {
      return { ...primitive, start: transformPoint(primitive.start), end: transformPoint(primitive.end) }
    }
    return primitive
  })

  const geometryBounds = calculateDrawingBounds(transformed, 'geometry')
  const annotationBounds = calculateDrawingBounds(transformed, 'annotation')
  // Include paper-space strokes and dimension arrowheads without changing model geometry.
  const completeBounds = expandDrawingBounds(calculateDrawingBounds(transformed), millimetres(0.7))
  const fits = completeBounds.minX >= contentBounds.minX && completeBounds.maxX <= contentBounds.maxX &&
    completeBounds.minY >= contentBounds.minY && completeBounds.maxY <= contentBounds.maxY

  return {
    mode: 'fixed-page', primitives: transformed,
    geometryBounds, annotationBounds, completeBounds, fit: fits ? 'fits' : 'does-not-fit',
    viewBounds: { minX: millimetres(0), minY: millimetres(0), maxX: millimetres(pageWidth), maxY: millimetres(pageHeight) },
    page: { format: 'A4', orientation: portrait ? 'portrait' : 'landscape', widthMm: millimetres(pageWidth),
      heightMm: millimetres(pageHeight), contentBounds,
      marginMm: millimetres(margin), titleBlockReserveMm: millimetres(titleBlockReserve) },
  }
}

export const drawingPoint = point
