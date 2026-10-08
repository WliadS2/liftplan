import { millimetres } from '../engineering'
import { projectCarrierMechanicalPrimitives } from './carrier-mechanical-drawings'
import { layoutGoodsDrawingAnnotations } from './goods-drawing-annotation-layout'
import type { CarLiftPlanningConfiguration } from '../elevator/configuration/car-lift-configuration'
import { createCarLiftNormalizedModel, type CarBoxMm, type CarLiftNormalizedModel } from '../elevator/car/car-lift-model'
import { validateCarLiftSpatialGeometry, type CarSpatialValidationResult } from '../collision/car-lift-spatial-validation'
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

export interface CarLiftDrawingContext {
  readonly configuration: CarLiftPlanningConfiguration
  readonly model: CarLiftNormalizedModel
  readonly validation: CarSpatialValidationResult
}

export interface CarDoorDrawingSelection {
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
const boxWidth = (box: CarBoxMm) => box.maxX - box.minX
const boxDepth = (box: CarBoxMm) => box.maxZ - box.minZ
const boxHeight = (box: CarBoxMm) => box.maxY - box.minY
const scaleMetadata = (scale: TechnicalDrawingScale) => ({
  requested: scale,
  previewMode: scale === 'auto' ? 'automatic-fit' as const : 'fixed-page' as const,
  printAccuracy: false as const,
  denominator: scale === 'auto' ? undefined : Number(scale.slice(2)) as 20 | 25 | 50 | 100,
  detail: technicalDrawingDetail(scale),
})
const status = (context: CarLiftDrawingContext, complete: boolean) =>
  context.validation.status === 'invalid' ? 'conflict' as const : complete ? 'complete' as const : 'incomplete' as const

export function createCarLiftDrawingContext(configuration: CarLiftPlanningConfiguration): CarLiftDrawingContext | undefined {
  const normalized = createCarLiftNormalizedModel(configuration)
  if (normalized.status === 'empty') return undefined
  return { configuration, model: normalized.model, validation: validateCarLiftSpatialGeometry(normalized) }
}

export function createCarLiftPlanDrawing(context: CarLiftDrawingContext,
  scale: TechnicalDrawingScale = 'auto'): TechnicalDrawingDocument {
  const primitives: TechnicalDrawingPrimitive[] = projectCarrierMechanicalPrimitives('car','plan',context.model.mechanical,context.model.drive)
  const { shaft, platform, vehicle } = context.model
  if (shaft) {
    primitives.push(rect('car-shaft', 'cut', shaft.minX, -shaft.maxZ, boxWidth(shaft), boxDepth(shaft), 'car-shaft'))
    primitives.push(line('car-shaft-axis-x', 'centerline', shaft.minX - 120, 0, shaft.maxX + 120, 0))
    primitives.push(line('car-shaft-axis-z', 'centerline', 0, -shaft.maxZ - 120, 0, -shaft.minZ + 120))
    primitives.push(horizontalDimension('car-shaft-width', 'shaft-width', shaft.minX, shaft.maxX,
      -shaft.minZ, -shaft.minZ + 300, millimetres(boxWidth(shaft))))
    primitives.push(verticalDimension('car-shaft-depth', 'shaft-depth', -shaft.maxZ, -shaft.minZ,
      shaft.maxX, shaft.maxX + 300, millimetres(boxDepth(shaft))))
  }
  if (platform) {
    primitives.push(rect('car-platform', 'visible', platform.minX, -platform.maxZ,
      boxWidth(platform), boxDepth(platform), 'car-platform'))
    primitives.push(horizontalDimension('car-platform-width', 'platform-width', platform.minX, platform.maxX,
      -platform.maxZ, -platform.maxZ - 300, millimetres(boxWidth(platform))))
    primitives.push(verticalDimension('car-platform-depth', 'platform-depth', -platform.maxZ, -platform.minZ,
      platform.minX, platform.minX - 300, millimetres(boxDepth(platform))))
  }
  if (vehicle?.footprint) {
    primitives.push({
      id: 'car-vehicle-envelope', kind: 'polyline', role: 'visible', layer: 'geometry', closed: true,
      points: vehicle.footprint.map((point) => drawingPoint(point.x, -point.z)),
    })
  }
  if (vehicle?.centerline) {
    primitives.push(line('car-vehicle-centerline', 'centerline', vehicle.centerline[0].x, -vehicle.centerline[0].z,
      vehicle.centerline[1].x, -vehicle.centerline[1].z))
  }
  vehicle?.wheelContactPoints?.forEach((point, index) => {
    primitives.push({
      id: `car-wheel-contact-${index + 1}`, kind: 'circle', role: 'secondary', layer: 'geometry',
      center: drawingPoint(point.x, -point.z), radius: millimetres(45),
    })
  })
  if (vehicle?.wheelContactPoints?.length === 4) {
    const wheels = vehicle.wheelContactPoints
    // Actual rotated contact positions, not assumed tire sizes or axle clearances.
    for (const [name, a, b] of [['rear', wheels[0], wheels[1]], ['front', wheels[2], wheels[3]]] as const) {
      primitives.push(line(`car-vehicle-${name}-axle`, 'centerline', a.x, -a.z, b.x, -b.z))
    }
    primitives.push(line('car-vehicle-wheelbase-reference', 'centerline', wheels[0].x, -wheels[0].z, wheels[2].x, -wheels[2].z))
  }
  const envelopes = [context.model.entryApproachEnvelope, context.model.exitApproachEnvelope, context.model.vehicleSweptEnvelope]
  envelopes.forEach((envelope) => {
    if (!envelope) return
    primitives.push(rect(envelope.id, 'hidden', envelope.bounds.minX, -envelope.bounds.maxZ,
      boxWidth(envelope.bounds), boxDepth(envelope.bounds), envelope.id))
  })
  context.model.entrances.forEach((entrance) => {
    if (!platform) return
    const y = entrance.side === 'front' ? -platform.maxZ : -platform.minZ
    primitives.push(line(`${entrance.id}-opening`, 'visible', -entrance.clearWidthMm / 2, y, entrance.clearWidthMm / 2, y))
  })
  if (context.model.guideSystem && shaft && !context.model.mechanical?.parts.some((p)=>p.kind === 'guide')) {
    const half = context.model.guideSystem.spacingMm / 2
    if (context.model.guideSystem.orientation === 'x') {
      primitives.push(line('car-guide-a', 'visible', -half, -shaft.maxZ, -half, -shaft.minZ))
      primitives.push(line('car-guide-b', 'visible', half, -shaft.maxZ, half, -shaft.minZ))
    } else {
      primitives.push(line('car-guide-a', 'visible', shaft.minX, -half, shaft.maxX, -half))
      primitives.push(line('car-guide-b', 'visible', shaft.minX, half, shaft.maxX, half))
    }
  }
  const complete = Boolean(shaft && platform)
  return createTechnicalDrawingDocument({
    id: 'car-plan', title: 'Grundriss', view: 'plan', status: status(context, complete),
    incompleteMessage: complete ? undefined : 'Für den Grundriss fehlen Schacht- oder Plattformdaten.',
    coordinateSystem: 'X horizontal; Z vertical with page Y = -Z', scale: scaleMetadata(scale),
    annotationLayout:'goods-columns', primitives:layoutGoodsDrawingAnnotations(primitives,100),
  })
}

export function createCarLiftSectionDrawing(context: CarLiftDrawingContext,
  scale: TechnicalDrawingScale = 'auto'): TechnicalDrawingDocument {
  const primitives: TechnicalDrawingPrimitive[] = projectCarrierMechanicalPrimitives('car','section',context.model.mechanical,context.model.drive)
  const { shaft, platform, levels, vehicle } = context.model
  if (shaft) {
    primitives.push(rect('car-shaft-section', 'cut', shaft.minX, -shaft.maxY,
      boxWidth(shaft), boxHeight(shaft), 'car-shaft'))
    primitives.push(line('car-shaft-section-axis', 'centerline', 0, -shaft.maxY - 100, 0, -shaft.minY + 100))
    primitives.push(verticalDimension('car-installation-height', 'installation-height', -shaft.maxY, -shaft.minY,
      shaft.maxX, shaft.maxX + 500, millimetres(boxHeight(shaft))))
    const lowest = levels[0]?.elevationMm
    const highest = levels.at(-1)?.elevationMm
    if (lowest !== undefined && shaft.minY <= lowest) {
      primitives.push(verticalDimension('car-pit-depth', 'pit-depth', -lowest, -shaft.minY,
        shaft.minX, shaft.minX - 350, millimetres(lowest - shaft.minY)))
    }
    if (highest !== undefined && platform) {
      const usableHeight = platform.maxY - platform.minY
      const cabinTopAtHighest = highest + usableHeight
      if (shaft.maxY >= cabinTopAtHighest) {
        primitives.push(verticalDimension('car-headroom', 'headroom', -shaft.maxY, -cabinTopAtHighest,
          shaft.minX, shaft.minX - 650, millimetres(shaft.maxY - cabinTopAtHighest)))
      }
    }
  }
  if (platform) {
    primitives.push(line('car-platform-section', 'visible', platform.minX, -platform.minY, platform.maxX, -platform.minY))
    if (vehicle?.heightMm) {
      const width = context.model.vehicleLoadingDirection === 'shaft-x' ? vehicle.lengthMm : vehicle.widthMm
      primitives.push(rect('car-vehicle-height-envelope', 'secondary', -width / 2, -(platform.minY + vehicle.heightMm),
        width, vehicle.heightMm, 'car-vehicle'))
    }
  }
  levels.forEach((level) => {
    const left = shaft?.minX ?? -500
    const right = shaft?.maxX ?? 500
    primitives.push(line(`car-${level.id}`, 'level', left - 200, -level.elevationMm, right + 200, -level.elevationMm))
    primitives.push(text(`car-${level.id}-label`, `Haltestelle ${level.index + 1}`, right + 450, -level.elevationMm))
    // Shared front/rear clear dimensions coincide in this X/Y projection.
    const entrance = context.model.entrances[0]
    if (entrance) primitives.push(rect(`car-landing-${level.id}-opening`, 'hidden',
      -entrance.clearWidthMm / 2, -level.elevationMm - entrance.clearHeightMm,
      entrance.clearWidthMm, entrance.clearHeightMm, entrance.id))
  })
  const complete = Boolean(shaft && levels.length)
  return createTechnicalDrawingDocument({
    id: 'car-section', title: 'Schnitt', view: 'section', status: status(context, complete),
    incompleteMessage: complete ? undefined : 'Für den Schnitt fehlen Schacht- oder Haltestellendaten.',
    coordinateSystem: 'X horizontal; Y vertical with page Y = -Y', scale: scaleMetadata(scale),
    annotationLayout:'goods-columns', primitives:layoutGoodsDrawingAnnotations(primitives,100),
  })
}

export function createCarLiftDoorElevationDrawing(context: CarLiftDrawingContext,
  selection: CarDoorDrawingSelection = {}, scale: TechnicalDrawingScale = 'auto'): TechnicalDrawingDocument {
  const level = context.model.levels.find((entry) => entry.id === selection.levelId) ?? context.model.levels[0]
  const side = selection.side ?? 'front'
  const entrance = context.model.entrances.find((entry) => entry.side === side)
  const primitives: TechnicalDrawingPrimitive[] = []
  if (entrance) {
    primitives.push(rect('car-door-opening', 'cut', -entrance.clearWidthMm / 2, -entrance.clearHeightMm,
      entrance.clearWidthMm, entrance.clearHeightMm, entrance.id))
    primitives.push(line('car-door-axis', 'centerline', 0, -entrance.clearHeightMm - 180, 0, 140))
    primitives.push(line('car-door-threshold', 'level', -entrance.clearWidthMm / 2 - 200, 0, entrance.clearWidthMm / 2 + 200, 0))
    primitives.push(horizontalDimension('car-door-width', 'door-width', -entrance.clearWidthMm / 2,
      entrance.clearWidthMm / 2, 0, 300, entrance.clearWidthMm))
    primitives.push(verticalDimension('car-door-height', 'door-height', -entrance.clearHeightMm, 0,
      entrance.clearWidthMm / 2, entrance.clearWidthMm / 2 + 300, entrance.clearHeightMm))
    if (context.model.vehicle && context.model.vehicleLoadingDirection) {
      const vehicleWidth = context.model.vehicleLoadingDirection === 'shaft-z'
        ? context.model.vehicle.widthMm : context.model.vehicle.lengthMm
      const vehicleHeight = context.model.vehicle.heightMm
      if (vehicleHeight) {
        primitives.push(rect('car-vehicle-door-clearance', 'hidden', -vehicleWidth / 2, -vehicleHeight,
          vehicleWidth, vehicleHeight, 'car-vehicle'))
      }
    }
    primitives.push(text('car-door-title', `${level ? `Haltestelle ${level.index + 1}` : 'Haltestelle nicht gewählt'} · ${side === 'front' ? 'Vorne' : 'Hinten'}`,
      0, -entrance.clearHeightMm - 260))
  }
  const complete = Boolean(entrance && level)
  return createTechnicalDrawingDocument({
    id: `car-door-${level?.id ?? 'none'}-${side}`, title: 'Türansicht', view: 'door-elevation',
    status: status(context, complete),
    incompleteMessage: complete ? undefined : 'Für diese Türansicht fehlen Zugangs- oder Haltestellendaten.',
    coordinateSystem: 'Entrance-local width horizontal; Y vertical with page Y = -Y', scale: scaleMetadata(scale), primitives,
  })
}
