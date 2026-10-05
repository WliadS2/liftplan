import { millimetres, millimetresToMetres, type Metres } from '../../engineering'
import type { CarBoxMm, CarLiftNormalizedModel, CarPlanPointMm } from './car-lift-model'

export interface CarSceneBox {
  readonly id: string
  readonly kind: 'shaft' | 'platform' | 'door' | 'guide' | 'moving-envelope' |
    'vehicle-body' | 'wheel-contact' | 'approach-envelope' | 'vehicle-swept-envelope' | 'door-passage-envelope'
  readonly center: readonly [Metres, Metres, Metres]
  readonly size: readonly [Metres, Metres, Metres]
  readonly headingDegrees?: number
}

export interface CarSceneLine {
  readonly id: string
  readonly kind: 'vehicle-centerline'
  readonly start: readonly [Metres, Metres, Metres]
  readonly end: readonly [Metres, Metres, Metres]
}

export interface CarLiftSceneModel {
  readonly family: 'car'
  readonly assemblies: readonly (CarSceneBox | CarSceneLine)[]
}

function box(id: string, kind: CarSceneBox['kind'], value: CarBoxMm, headingDegrees?: number): CarSceneBox {
  return {
    id, kind, headingDegrees,
    center: [
      millimetresToMetres(millimetres((value.minX + value.maxX) / 2)),
      millimetresToMetres(millimetres((value.minY + value.maxY) / 2)),
      millimetresToMetres(millimetres((value.minZ + value.maxZ) / 2)),
    ],
    size: [
      millimetresToMetres(millimetres(value.maxX - value.minX)),
      millimetresToMetres(millimetres(value.maxY - value.minY)),
      millimetresToMetres(millimetres(value.maxZ - value.minZ)),
    ],
  }
}

function scenePoint(point: CarPlanPointMm, yMm: number): readonly [Metres, Metres, Metres] {
  return [millimetresToMetres(point.x), millimetresToMetres(millimetres(yMm)), millimetresToMetres(point.z)]
}

/** Render-neutral contract. Millimetres cross into metres only in this adapter. */
export function createCarLiftSceneModel(model: CarLiftNormalizedModel): CarLiftSceneModel {
  const assemblies: (CarSceneBox | CarSceneLine)[] = []
  if (model.shaft) assemblies.push(box('car-shaft', 'shaft', model.shaft))
  if (model.platform) assemblies.push(box('car-platform', 'platform', model.platform))
  if (model.movingEnvelope) assemblies.push(box('car-moving-envelope', 'moving-envelope', model.movingEnvelope))
  if (model.vehicle?.bounds && model.vehicle.center && model.vehicle.heightMm) {
    assemblies.push({
      id: 'car-vehicle-body', kind: 'vehicle-body', headingDegrees: model.vehicle.headingDegrees,
      center: [millimetresToMetres(model.vehicle.center.x),
        millimetresToMetres(millimetres((model.vehicle.bounds.minY + model.vehicle.bounds.maxY) / 2)),
        millimetresToMetres(model.vehicle.center.z)],
      size: [millimetresToMetres(model.vehicle.widthMm),
        millimetresToMetres(millimetres(model.vehicle.bounds.maxY - model.vehicle.bounds.minY)),
        millimetresToMetres(model.vehicle.lengthMm)],
    })
  }
  const addApproach = (value: NonNullable<CarLiftNormalizedModel['entryApproachEnvelope']>, kind: CarSceneBox['kind']) => {
    assemblies.push({
      id: value.id, kind, headingDegrees: value.headingDegrees,
      center: [millimetresToMetres(value.center.x),
        millimetresToMetres(millimetres((value.bounds.minY + value.bounds.maxY) / 2)),
        millimetresToMetres(value.center.z)],
      size: [millimetresToMetres(value.widthMm),
        millimetresToMetres(millimetres(value.bounds.maxY - value.bounds.minY)),
        millimetresToMetres(value.lengthMm)],
    })
  }
  if (model.entryApproachEnvelope) addApproach(model.entryApproachEnvelope, 'approach-envelope')
  if (model.exitApproachEnvelope) addApproach(model.exitApproachEnvelope, 'approach-envelope')
  if (model.vehicleSweptEnvelope) addApproach(model.vehicleSweptEnvelope, 'vehicle-swept-envelope')
  if (model.doorPassageEnvelope?.clearWidthMm && model.doorPassageEnvelope.clearHeightMm && model.platform) {
    const depth = model.doorPassageEnvelope.depthMm ?? millimetres(0)
    assemblies.push({
      id: 'car-door-passage-envelope', kind: 'door-passage-envelope',
      center: [millimetresToMetres(millimetres(0)), millimetresToMetres(millimetres(model.platform.minY + model.doorPassageEnvelope.clearHeightMm / 2)),
        millimetresToMetres(millimetres(model.platform.maxZ + depth / 2))],
      size: [millimetresToMetres(model.doorPassageEnvelope.clearWidthMm), millimetresToMetres(model.doorPassageEnvelope.clearHeightMm),
        millimetresToMetres(depth)],
    })
  }
  if (model.guideSystem && model.shaft) {
    const half = model.guideSystem.spacingMm / 2
    const height = millimetres(model.shaft.maxY - model.shaft.minY)
    const centerY = millimetres((model.shaft.minY + model.shaft.maxY) / 2)
    const guide = (id: string, offset: number): CarSceneBox => ({
      id, kind: 'guide',
      center: model.guideSystem!.orientation === 'x'
        ? [millimetresToMetres(millimetres(offset)), millimetresToMetres(centerY), millimetresToMetres(millimetres(0))]
        : [millimetresToMetres(millimetres(0)), millimetresToMetres(centerY), millimetresToMetres(millimetres(offset))],
      size: [millimetresToMetres(millimetres(0)), millimetresToMetres(height), millimetresToMetres(millimetres(0))],
    })
    assemblies.push(guide('car-guide-a', -half), guide('car-guide-b', half))
  }
  if (model.platform) {
    model.entrances.forEach((entrance) => {
      const z = entrance.side === 'front' ? model.platform!.maxZ : model.platform!.minZ
      assemblies.push({
        id: entrance.id, kind: 'door',
        center: [millimetresToMetres(millimetres(0)), millimetresToMetres(millimetres(model.platform!.minY + entrance.clearHeightMm / 2)),
          millimetresToMetres(z)],
        size: [millimetresToMetres(entrance.clearWidthMm), millimetresToMetres(entrance.clearHeightMm), millimetresToMetres(millimetres(0))],
      })
    })
  }
  model.vehicle?.wheelContactPoints?.forEach((point, index) => {
    const y = model.platform?.minY ?? millimetres(0)
    assemblies.push({
      id: `car-wheel-contact-${index + 1}`, kind: 'wheel-contact',
      center: scenePoint(point, y),
      size: [millimetresToMetres(millimetres(0)), millimetresToMetres(millimetres(0)), millimetresToMetres(millimetres(0))],
    })
  })
  if (model.vehicle?.centerline) {
    const y = model.platform?.minY ?? millimetres(0)
    assemblies.push({
      id: 'car-vehicle-centerline', kind: 'vehicle-centerline',
      start: scenePoint(model.vehicle.centerline[0], y), end: scenePoint(model.vehicle.centerline[1], y),
    })
  }
  return { family: 'car', assemblies }
}
