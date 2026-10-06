import { millimetres } from '../engineering'
import type { GoodsLiftPlanningConfiguration } from '../elevator'
import { createGoodsLiftNormalizedModel, type GoodsBoxMm, type GoodsLiftNormalizedModel } from '../elevator/goods/goods-lift-model'
import { validateGoodsLiftSpatialGeometry, type GoodsSpatialValidationResult } from '../collision/goods-lift-spatial-validation'
import {
  createTechnicalDrawingDocument,
  componentAnnotation,
  drawingPoint,
  horizontalDimension,
  technicalDrawingDetail,
  verticalDimension,
  type DrawingRectangle,
  type TechnicalDrawingDocument,
  type TechnicalDrawingPrimitive,
  type TechnicalDrawingScale,
} from './technical-drawing'
import { layoutGoodsDrawingAnnotations } from './goods-drawing-annotation-layout'

export interface GoodsLiftDrawingContext {
  readonly configuration: GoodsLiftPlanningConfiguration
  readonly model: GoodsLiftNormalizedModel
  readonly validation: GoodsSpatialValidationResult
}

export interface GoodsDoorDrawingSelection {
  readonly levelId?: string
  readonly side?: 'front' | 'rear'
}

const rect = (id: string, role: DrawingRectangle['role'], x: number, y: number, width: number, height: number,
  componentId?: string): DrawingRectangle => ({
  id, kind: 'component-outline', role, layer: 'geometry', x: millimetres(x), y: millimetres(y),
  width: millimetres(width), height: millimetres(height), componentId,
})
const line = (id: string, role: 'visible' | 'centerline' | 'level', x1: number, y1: number, x2: number, y2: number): TechnicalDrawingPrimitive => ({
  id, kind: role === 'centerline' ? 'centerline' : 'line', role, layer: 'geometry',
  start: drawingPoint(x1, y1), end: drawingPoint(x2, y2),
})
const annotate = (id: string, value: string, x: number, y: number, side: 'left' | 'right' = 'right') =>
  componentAnnotation(id, value, drawingPoint(x, y), drawingPoint(x, y)).map((entry) =>
    entry.kind === 'text' ? { ...entry, annotationSide: side } : entry)
const loads = (model: GoodsLiftNormalizedModel): readonly [string, string, GoodsBoxMm | undefined, 'secondary' | 'hidden' | 'centerline'][] => [
  ['goods-pallet', 'Palette (Hülle)', model.pallet, 'secondary'],
  ['goods-roll-container', 'Rollcontainer (Hülle)', model.rollContainer, 'hidden'],
  ['goods-forklift-envelope', 'Gabelstapler-Hülle', model.forkliftEnvelope, 'centerline'],
]
const finishPrimitives = (primitives: readonly TechnicalDrawingPrimitive[]) => layoutGoodsDrawingAnnotations(primitives, 100)
const boxWidth = (box: GoodsBoxMm) => box.maxX - box.minX
const boxDepth = (box: GoodsBoxMm) => box.maxZ - box.minZ
const boxHeight = (box: GoodsBoxMm) => box.maxY - box.minY
const scaleMetadata = (scale: TechnicalDrawingScale) => ({
  requested: scale,
  previewMode: scale === 'auto' ? 'automatic-fit' as const : 'fixed-page' as const,
  printAccuracy: false as const,
  denominator: scale === 'auto' ? undefined : Number(scale.slice(2)) as 20 | 25 | 50 | 100,
  detail: technicalDrawingDetail(scale),
})
const status = (context: GoodsLiftDrawingContext, complete: boolean) =>
  context.validation.status === 'invalid' ? 'conflict' as const : complete ? 'complete' as const : 'incomplete' as const

export function createGoodsLiftDrawingContext(configuration: GoodsLiftPlanningConfiguration): GoodsLiftDrawingContext | undefined {
  const normalized = createGoodsLiftNormalizedModel(configuration)
  if (normalized.status === 'empty') return undefined
  return { configuration, model: normalized.model, validation: validateGoodsLiftSpatialGeometry(normalized) }
}

export function createGoodsLiftPlanDrawing(context: GoodsLiftDrawingContext,
  scale: TechnicalDrawingScale = 'auto'): TechnicalDrawingDocument {
  const primitives: TechnicalDrawingPrimitive[] = []
  const { shaft, platform } = context.model
  if (shaft) {
    primitives.push(rect('goods-shaft', 'cut', shaft.minX, -shaft.maxZ, boxWidth(shaft), boxDepth(shaft), 'goods-shaft'))
    primitives.push(line('goods-shaft-axis-x', 'centerline', shaft.minX - 120, 0, shaft.maxX + 120, 0))
    primitives.push(line('goods-shaft-axis-z', 'centerline', 0, -shaft.maxZ - 120, 0, -shaft.minZ + 120))
    primitives.push(horizontalDimension('goods-shaft-width', 'shaft-width', shaft.minX, shaft.maxX,
      -shaft.minZ, -shaft.minZ + 300, millimetres(boxWidth(shaft))))
    primitives.push(verticalDimension('goods-shaft-depth', 'shaft-depth', -shaft.maxZ, -shaft.minZ,
      shaft.maxX, shaft.maxX + 300, millimetres(boxDepth(shaft))))
  }
  if (platform) {
    primitives.push(rect('goods-platform', 'visible', platform.minX, -platform.maxZ,
      boxWidth(platform), boxDepth(platform), 'goods-platform'))
    primitives.push(...annotate('goods-platform-label', 'Ladefläche', platform.minX, -platform.minZ, 'left'))
    primitives.push({ ...horizontalDimension('goods-platform-width', 'platform-width', platform.minX, platform.maxX,
      -platform.maxZ, -platform.maxZ - 500, millimetres(boxWidth(platform))), paperOffsetMm: 13 })
    primitives.push({ ...verticalDimension('goods-platform-depth', 'platform-depth', -platform.maxZ, -platform.minZ,
      platform.minX, (shaft?.minX ?? platform.minX) - 500, millimetres(boxDepth(platform))), paperOffsetMm: 18 })
  }
  loads(context.model).forEach(([id, label, load, role], index) => {
    if (!load) return
    primitives.push(rect(id, role, load.minX, -load.maxZ, boxWidth(load), boxDepth(load), id))
    const side = index === 0 ? 'left' : 'right'
    primitives.push(...annotate(`${id}-label`, label, side === 'left' ? load.minX : load.maxX, -load.maxZ, side))
  })
  context.model.entrances.forEach((entrance) => {
    if (!platform) return
    const y = entrance.side === 'front' ? -platform.maxZ : -platform.minZ
    primitives.push(line(`${entrance.id}-opening`, 'visible', -entrance.widthMm / 2, y, entrance.widthMm / 2, y))
    primitives.push(...annotate(`${entrance.id}-label`, `Öffnung ${entrance.side === 'front' ? 'vorne' : 'hinten'}`,
      entrance.widthMm / 2, y))
    // Front and rear share one explicit width in the current goods contract.
    // One width dimension is sufficient; independent widths can later add a second.
    if (entrance === context.model.entrances[0]) {
      primitives.push({ ...horizontalDimension('goods-door-width', 'door-width', -entrance.widthMm / 2,
        entrance.widthMm / 2, y, y + (entrance.side === 'front' ? -300 : 300), entrance.widthMm), paperOffsetMm: 8 })
    }
  })
  if (context.model.guideSystem && shaft) {
    const half = context.model.guideSystem.spacingMm / 2
    const alongX = context.model.guideSystem.orientation === 'x'
    const denominator = scale === 'auto' ? undefined : Number(scale.slice(2))
    const outsideOffset = denominator
      ? (alongX ? shaft.maxZ : shaft.maxX) / denominator + 22 : 28
    for (const [id, coordinate] of [['goods-guide-a', -half], ['goods-guide-b', half]] as const) {
      const x = alongX ? coordinate : 0, y = alongX ? 0 : -coordinate
      // Crossed axes are symbolic linework, not an invented rail profile.
      primitives.push(line(`${id}-x`, 'visible', x - 35, y, x + 35, y),
        line(`${id}-z`, 'visible', x, y - 35, x, y + 35))
    }
    primitives.push(...annotate('goods-guides-label', 'Schienenachsen', alongX ? -half : 0, alongX ? 0 : -half, 'left'))
    primitives.push(alongX
      ? { ...horizontalDimension('goods-guide-spacing', 'guide-spacing', -half, half, 0, -shaft.maxZ - 800,
        context.model.guideSystem.spacingMm), paperOffsetMm: outsideOffset }
      : { ...verticalDimension('goods-guide-spacing', 'guide-spacing', -half, half, 0, shaft.maxX + 800,
        context.model.guideSystem.spacingMm), paperOffsetMm: outsideOffset })
  }
  const complete = Boolean(shaft && platform)
  return createTechnicalDrawingDocument({
    id: 'goods-plan', title: 'Grundriss', view: 'plan', status: status(context, complete),
    incompleteMessage: complete ? undefined : 'Für den Grundriss fehlen Schacht- oder Ladeflächendaten.',
    coordinateSystem: 'X horizontal; Z vertical with page Y = -Z', scale: scaleMetadata(scale),
    annotationLayout: 'goods-columns', primitives: finishPrimitives(primitives),
  })
}

export function createGoodsLiftSectionDrawing(context: GoodsLiftDrawingContext,
  scale: TechnicalDrawingScale = 'auto'): TechnicalDrawingDocument {
  const primitives: TechnicalDrawingPrimitive[] = []
  const { shaft, platform, levels } = context.model
  if (shaft) {
    primitives.push(rect('goods-shaft-section', 'cut', shaft.minX, -shaft.maxY,
      boxWidth(shaft), boxHeight(shaft), 'goods-shaft'))
    primitives.push(line('goods-shaft-section-axis', 'centerline', 0, -shaft.maxY - 100, 0, -shaft.minY + 100))
    primitives.push(verticalDimension('goods-installation-height', 'installation-height', -shaft.maxY, -shaft.minY,
      shaft.maxX, shaft.maxX + 500, millimetres(boxHeight(shaft))))
  }
  if (platform) {
    primitives.push(rect('goods-platform-section', 'visible', platform.minX, -platform.maxY,
      boxWidth(platform), boxHeight(platform), 'goods-platform'))
    primitives.push(...annotate('goods-platform-section-label', 'Ladefläche/Kabine', platform.minX, -platform.maxY, 'left'))
    loads(context.model).forEach(([id, label, load, role], index) => {
      if (!load || load.maxY === load.minY) return
      primitives.push(rect(`${id}-section`, role, load.minX, -load.maxY, boxWidth(load), boxHeight(load), id))
      primitives.push(...annotate(`${id}-section-label`, label, load.minX, -load.maxY, index === 2 ? 'right' : 'left'))
    })
  }
  levels.forEach((level) => {
    const left = shaft?.minX ?? platform?.minX
    const right = shaft?.maxX ?? platform?.maxX
    if (left === undefined || right === undefined) return
    primitives.push(line(`goods-${level.id}`, 'level', left - 200, -level.elevationMm, right + 200, -level.elevationMm))
    primitives.push(...annotate(`goods-${level.id}-label`, `Haltestelle ${level.index + 1} · ${level.elevationMm} mm`,
      right + 200, -level.elevationMm))
    // Front/rear openings coincide in this X/Y projection. A single outline
    // represents their explicit shared dimensions rather than duplicate edges.
    const entrance = context.model.entrances[0]
    if (entrance) primitives.push(rect(`goods-landing-${level.id}-opening`, 'hidden',
      -entrance.widthMm / 2, -level.elevationMm - entrance.heightMm, entrance.widthMm, entrance.heightMm, entrance.id))
    const previous = levels[level.index - 1]
    if (previous) primitives.push({ ...verticalDimension(`goods-storey-${level.index}`, 'storey-height',
      -level.elevationMm, -previous.elevationMm, left, left - 500,
      millimetres(level.elevationMm - previous.elevationMm)), paperOffsetMm: 12 })
  })
  if (shaft && levels.length && platform) {
    const lowest = levels[0].elevationMm, highest = levels.at(-1)!.elevationMm
    const roofAtTop = highest + boxHeight(platform)
    primitives.push({ ...verticalDimension('goods-pit-depth', 'pit-depth', -lowest, -shaft.minY,
      shaft.minX, shaft.minX - 500, millimetres(lowest - shaft.minY)), paperOffsetMm: 12 })
    primitives.push({ ...verticalDimension('goods-headroom', 'headroom', -shaft.maxY, -roofAtTop,
      shaft.minX, shaft.minX - 500, millimetres(shaft.maxY - roofAtTop)), paperOffsetMm: 12 })
    primitives.push(...annotate('goods-access-section-label', `Zugänge: ${context.model.entrances.map((entry) =>
      entry.side === 'front' ? 'vorne' : 'hinten').join(' / ')}`, shaft.maxX, -roofAtTop))
  }
  if (shaft && context.model.guideSystem) {
    const alongX = context.model.guideSystem.orientation === 'x'
    const half = context.model.guideSystem.spacingMm / 2
    const coordinates = alongX ? [-half, half] : [0]
    coordinates.forEach((x, index) => primitives.push(line(`goods-guide-${index ? 'b' : 'a'}-section`, 'visible',
      x, -shaft.maxY, x, -shaft.minY)))
    primitives.push(...annotate('goods-guides-section-label', alongX ? 'Schienenachsen' : 'Schienenachsen (deckungsgleich)',
      coordinates[0], -(shaft.minY + shaft.maxY) / 2, 'left'))
  }
  const complete = Boolean(shaft && levels.length)
  return createTechnicalDrawingDocument({
    id: 'goods-section', title: 'Schnitt', view: 'section', status: status(context, complete),
    incompleteMessage: complete ? undefined : 'Für den Schnitt fehlen Schacht- oder Haltestellendaten.',
    coordinateSystem: 'X horizontal; Y vertical with page Y = -Y', scale: scaleMetadata(scale),
    annotationLayout: 'goods-columns', primitives: finishPrimitives(primitives),
  })
}

export function createGoodsLiftDoorElevationDrawing(context: GoodsLiftDrawingContext,
  selection: GoodsDoorDrawingSelection = {}, scale: TechnicalDrawingScale = 'auto'): TechnicalDrawingDocument {
  const level = selection.levelId === undefined ? context.model.levels[0]
    : context.model.levels.find((entry) => entry.id === selection.levelId)
  const side = selection.side ?? context.model.entrances[0]?.side ?? 'front'
  const entrance = context.model.entrances.find((entry) => entry.side === side)
  const primitives: TechnicalDrawingPrimitive[] = []
  if (entrance) {
    primitives.push(rect('goods-door-opening', 'cut', -entrance.widthMm / 2, -entrance.heightMm,
      entrance.widthMm, entrance.heightMm, entrance.id))
    primitives.push(line('goods-door-axis', 'centerline', 0, -entrance.heightMm - 180, 0, 140))
    primitives.push(line('goods-door-threshold', 'level', -entrance.widthMm / 2 - 200, 0, entrance.widthMm / 2 + 200, 0))
    primitives.push(horizontalDimension('goods-door-width', 'door-width', -entrance.widthMm / 2,
      entrance.widthMm / 2, 0, 300, entrance.widthMm))
    primitives.push(verticalDimension('goods-door-height', 'door-height', -entrance.heightMm, 0,
      entrance.widthMm / 2, entrance.widthMm / 2 + 300, entrance.heightMm))
    primitives.push(...annotate('goods-door-title', `${level ? `Haltestelle ${level.index + 1}` : 'Haltestelle nicht gewählt'} · ${side === 'front' ? 'Vorne' : 'Hinten'}`,
      -entrance.widthMm / 2, -entrance.heightMm, 'left'))
  }
  const complete = Boolean(entrance && level)
  return createTechnicalDrawingDocument({
    id: `goods-door-${level?.id ?? 'none'}-${side}`, title: 'Türansicht', view: 'door-elevation',
    status: status(context, complete),
    incompleteMessage: complete ? undefined : 'Für diese Türansicht fehlen Zugangs- oder Haltestellendaten.',
    coordinateSystem: 'Entrance-local width horizontal; Y vertical with page Y = -Y', scale: scaleMetadata(scale),
    annotationLayout: 'goods-columns', primitives: finishPrimitives(primitives),
  })
}
