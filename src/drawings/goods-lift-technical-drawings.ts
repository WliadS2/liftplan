import { millimetres } from '../engineering'
import type { GoodsLiftPlanningConfiguration } from '../elevator'
import { createGoodsLiftNormalizedModel, type GoodsBoxMm, type GoodsLiftNormalizedModel } from '../elevator/goods/goods-lift-model'
import { validateGoodsLiftSpatialGeometry, type GoodsSpatialValidationResult } from '../collision/goods-lift-spatial-validation'
import {
  createTechnicalDrawingDocument,
  drawingPoint,
  horizontalDimension,
  technicalDrawingDetail,
  verticalDimension,
  type DrawingRectangle,
  type TechnicalDrawingDocument,
  type TechnicalDrawingPrimitive,
  type TechnicalDrawingScale,
} from './technical-drawing'

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
const text = (id: string, value: string, x: number, y: number): TechnicalDrawingPrimitive => ({
  id, kind: 'text', role: 'secondary', layer: 'annotation', position: drawingPoint(x, y), text: value, anchor: 'middle',
})
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
    primitives.push(text('goods-platform-label', 'Ladefläche', 0, 0))
    primitives.push(horizontalDimension('goods-platform-width', 'platform-width', platform.minX, platform.maxX,
      -platform.maxZ, -platform.maxZ - 300, millimetres(boxWidth(platform))))
    primitives.push(verticalDimension('goods-platform-depth', 'platform-depth', -platform.maxZ, -platform.minZ,
      platform.minX, platform.minX - 300, millimetres(boxDepth(platform))))
  }
  const loads: readonly [string, string, GoodsBoxMm | undefined][] = [
    ['goods-pallet', 'Palette', context.model.pallet],
    ['goods-roll-container', 'Rollcontainer', context.model.rollContainer],
    ['goods-forklift-envelope', 'Staplerhülle', context.model.forkliftEnvelope],
  ]
  loads.forEach(([id, label, load]) => {
    if (!load) return
    primitives.push(rect(id, 'secondary', load.minX, -load.maxZ, boxWidth(load), boxDepth(load), id))
    primitives.push(text(`${id}-label`, label, 0, 0))
  })
  context.model.entrances.forEach((entrance) => {
    if (!platform) return
    const y = entrance.side === 'front' ? -platform.maxZ : -platform.minZ
    primitives.push(line(`${entrance.id}-opening`, 'visible', -entrance.widthMm / 2, y, entrance.widthMm / 2, y))
  })
  if (context.model.guideSystem && shaft) {
    const half = context.model.guideSystem.spacingMm / 2
    if (context.model.guideSystem.orientation === 'x') {
      primitives.push(line('goods-guide-a', 'visible', -half, -shaft.maxZ, -half, -shaft.minZ))
      primitives.push(line('goods-guide-b', 'visible', half, -shaft.maxZ, half, -shaft.minZ))
    } else {
      primitives.push(line('goods-guide-a', 'visible', shaft.minX, -half, shaft.maxX, -half))
      primitives.push(line('goods-guide-b', 'visible', shaft.minX, half, shaft.maxX, half))
    }
  }
  const complete = Boolean(shaft && platform)
  return createTechnicalDrawingDocument({
    id: 'goods-plan', title: 'Grundriss', view: 'plan', status: status(context, complete),
    incompleteMessage: complete ? undefined : 'Für den Grundriss fehlen Schacht- oder Ladeflächendaten.',
    coordinateSystem: 'X horizontal; Z vertical with page Y = -Z', scale: scaleMetadata(scale), primitives,
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
  }
  levels.forEach((level) => {
    const left = shaft?.minX ?? -500
    const right = shaft?.maxX ?? 500
    primitives.push(line(`goods-${level.id}`, 'level', left - 200, -level.elevationMm, right + 200, -level.elevationMm))
    primitives.push(text(`goods-${level.id}-label`, `Haltestelle ${level.index + 1}`, right + 450, -level.elevationMm))
  })
  const complete = Boolean(shaft && levels.length)
  return createTechnicalDrawingDocument({
    id: 'goods-section', title: 'Schnitt', view: 'section', status: status(context, complete),
    incompleteMessage: complete ? undefined : 'Für den Schnitt fehlen Schacht- oder Haltestellendaten.',
    coordinateSystem: 'X horizontal; Y vertical with page Y = -Y', scale: scaleMetadata(scale), primitives,
  })
}

export function createGoodsLiftDoorElevationDrawing(context: GoodsLiftDrawingContext,
  selection: GoodsDoorDrawingSelection = {}, scale: TechnicalDrawingScale = 'auto'): TechnicalDrawingDocument {
  const level = context.model.levels.find((entry) => entry.id === selection.levelId) ?? context.model.levels[0]
  const side = selection.side ?? 'front'
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
    primitives.push(text('goods-door-title', `${level ? `Haltestelle ${level.index + 1}` : 'Haltestelle nicht gewählt'} · ${side === 'front' ? 'Vorne' : 'Hinten'}`,
      0, -entrance.heightMm - 260))
  }
  const complete = Boolean(entrance && level)
  return createTechnicalDrawingDocument({
    id: `goods-door-${level?.id ?? 'none'}-${side}`, title: 'Türansicht', view: 'door-elevation',
    status: status(context, complete),
    incompleteMessage: complete ? undefined : 'Für diese Türansicht fehlen Zugangs- oder Haltestellendaten.',
    coordinateSystem: 'Entrance-local width horizontal; Y vertical with page Y = -Y', scale: scaleMetadata(scale), primitives,
  })
}
