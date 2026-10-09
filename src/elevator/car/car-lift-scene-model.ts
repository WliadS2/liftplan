import { millimetres, millimetresToMetres, type Metres } from '../../engineering'
import type { CarBoxMm, CarLiftNormalizedModel, CarPlanPointMm } from './car-lift-model'
import { createCarrierDriveScene, type CarrierDriveScene, type DriveSceneBox } from '../models/carrier-drive-scene'
import { isLandingSideServed } from '../configuration/landing-planning'

export interface CarSceneBox {
  readonly id: string
  readonly kind: 'shaft' | 'pit' | 'headroom' | 'level' | 'platform' | 'platform-floor' | 'platform-roof' | 'platform-wall' | 'door' | 'landing-door' | 'guide' | 'moving-envelope' |
    'vehicle-body' | 'wheel-contact' | 'approach-envelope' | 'vehicle-swept-envelope' | 'door-passage-envelope'
    | 'carrier-frame' | 'floor-structure' | 'guide-shoe' | 'buffer' | DriveSceneBox['kind']
  readonly driveAttachment?: DriveSceneBox['driveAttachment']
  readonly center: readonly [Metres, Metres, Metres]
  readonly size: readonly [Metres, Metres, Metres]
  readonly headingDegrees?: number
  readonly componentSource?: import('../configuration/carrier-mechanical-planning').CarrierComponentSource
  readonly doorAttachment?:
    | { readonly role: 'platform'; readonly side: 'front' | 'rear' }
    | { readonly role: 'landing'; readonly side: 'front' | 'rear'; readonly levelId: string }
}

export interface CarSceneLine {
  readonly id: string
  readonly kind: 'vehicle-centerline' | 'loading-direction' | 'vehicle-axle' | 'vehicle-reference'
  readonly start: readonly [Metres, Metres, Metres]
  readonly end: readonly [Metres, Metres, Metres]
  readonly label?: string
}

export interface CarLiftSceneModel {
  readonly drive?: CarrierDriveScene
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
  if (model.shaft) {
    const shaft = model.shaft
    assemblies.push(box('car-shaft', 'shaft', shaft))
    const lowest = model.levels[0]?.elevationMm
    const highest = model.levels.at(-1)?.elevationMm
    if (lowest !== undefined && shaft.minY < lowest) {
      assemblies.push(box('car-pit', 'pit', { ...shaft, maxY: lowest }))
    }
    if (highest !== undefined && model.platform) {
      const bottom = millimetres(highest + model.platform.maxY - model.platform.minY)
      if (bottom < shaft.maxY) assemblies.push(box('car-headroom', 'headroom', { ...shaft, minY: bottom }))
    }
  }
  const levelPlan = model.shaft ?? model.platform
  if (levelPlan) model.levels.forEach((level) => assemblies.push(box(`car-${level.id}`, 'level', {
    ...levelPlan, minY: level.elevationMm, maxY: level.elevationMm,
  })))
  if (model.platform) {
    const p = model.platform
    assemblies.push(box('car-platform', 'platform', p))
    assemblies.push(box('car-platform-floor', 'platform-floor', { ...p, maxY: p.minY }))
    assemblies.push(box('car-platform-roof', 'platform-roof', { ...p, minY: p.maxY }))
    assemblies.push(box('car-platform-wall-left', 'platform-wall', { ...p, maxX: p.minX }))
    assemblies.push(box('car-platform-wall-right', 'platform-wall', { ...p, minX: p.maxX }))
    for (const side of ['front', 'rear'] as const) {
      const z = side === 'front' ? p.maxZ : p.minZ
      const end = { ...p, minZ: z, maxZ: z }
      const entrance = model.entrances.find((entry) => entry.side === side)
      const id = `car-platform-wall-${side}`
      if (!entrance) assemblies.push(box(id, 'platform-wall', end))
      else {
        const half = millimetres(entrance.clearWidthMm / 2)
        if (-half > p.minX) assemblies.push(box(`${id}-left`, 'platform-wall', { ...end, maxX: millimetres(-half) }))
        if (half < p.maxX) assemblies.push(box(`${id}-right`, 'platform-wall', { ...end, minX: half }))
        const openingTop = millimetres(p.minY + entrance.clearHeightMm)
        if (openingTop < p.maxY) assemblies.push(box(`${id}-header`, 'platform-wall', {
          ...end, minX: millimetres(Math.max(p.minX, -half)), maxX: millimetres(Math.min(p.maxX, half)), minY: openingTop,
        }))
      }
    }
    if (model.vehicleLoadingDirection) {
      assemblies.push({ id: 'car-loading-direction', kind: 'loading-direction',
        start: scenePoint({ x: model.vehicleLoadingDirection === 'shaft-x' ? p.minX : millimetres(0),
          z: model.vehicleLoadingDirection === 'shaft-z' ? p.minZ : millimetres(0) }, p.minY),
        end: scenePoint({ x: model.vehicleLoadingDirection === 'shaft-x' ? p.maxX : millimetres(0),
          z: model.vehicleLoadingDirection === 'shaft-z' ? p.maxZ : millimetres(0) }, p.minY),
      })
    }
  }
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
    const passage = model.doorPassageEnvelope
    model.entrances.forEach((entrance) => {
      const z = entrance.side === 'front' ? model.platform!.maxZ + depth / 2 : model.platform!.minZ - depth / 2
      assemblies.push({
        id: `car-door-passage-envelope-${entrance.side}`, kind: 'door-passage-envelope',
        center: [millimetresToMetres(millimetres(0)), millimetresToMetres(millimetres(model.platform!.minY + passage.clearHeightMm! / 2)),
          millimetresToMetres(millimetres(z))],
        size: [millimetresToMetres(passage.clearWidthMm!), millimetresToMetres(passage.clearHeightMm!),
          millimetresToMetres(depth)],
      })
    })
  }
  if (model.guideSystem && model.shaft && !model.mechanical?.parts.some((part)=>part.kind === 'guide')) {
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
        doorAttachment: { role: 'platform', side: entrance.side },
        center: [millimetresToMetres(millimetres(0)), millimetresToMetres(millimetres(model.platform!.minY + entrance.clearHeightMm / 2)),
          millimetresToMetres(z)],
        size: [millimetresToMetres(entrance.clearWidthMm), millimetresToMetres(entrance.clearHeightMm), millimetresToMetres(millimetres(0))],
      })
      if (model.shaft) model.levels.filter((level) => isLandingSideServed(level, entrance.side)).forEach((level) => assemblies.push({
        id: `car-landing-${level.id}-${entrance.side}`, kind: 'landing-door',
        doorAttachment: { role: 'landing', side: entrance.side, levelId: level.id },
        center: [millimetresToMetres(millimetres(0)),
          millimetresToMetres(millimetres(level.elevationMm + entrance.clearHeightMm / 2)),
          millimetresToMetres(entrance.side === 'front' ? model.shaft!.maxZ : model.shaft!.minZ)],
        size: [millimetresToMetres(entrance.clearWidthMm), millimetresToMetres(entrance.clearHeightMm), millimetresToMetres(millimetres(0))],
      }))
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
    const contacts = model.vehicle.wheelContactPoints
    if (contacts?.length === 4) {
      const midpoint = (a: CarPlanPointMm, b: CarPlanPointMm): CarPlanPointMm => ({
        x: millimetres((a.x + b.x) / 2), z: millimetres((a.z + b.z) / 2),
      })
      const rear = midpoint(contacts[0], contacts[1]), front = midpoint(contacts[2], contacts[3])
      const reference = (id: string, a: CarPlanPointMm, b: CarPlanPointMm, label?: string,
        kind: CarSceneLine['kind'] = 'vehicle-reference') => assemblies.push({
        id, kind, start: scenePoint(a, y), end: scenePoint(b, y), label,
      })
      reference('car-rear-axle', contacts[0], contacts[1], undefined, 'vehicle-axle')
      reference('car-front-axle', contacts[2], contacts[3], undefined, 'vehicle-axle')
      reference('car-wheelbase', contacts[1], contacts[3], `Radstand ${model.vehicle.wheelbaseMm} mm`)
      // Reference lengths come from the normalized endpoints, not invented visual wheel dimensions.
      const length = (a: CarPlanPointMm, b: CarPlanPointMm) => Math.round(Math.hypot(b.x - a.x, b.z - a.z))
      reference('car-rear-overhang', model.vehicle.centerline[0], rear,
        `Überhang hinten ${length(model.vehicle.centerline[0], rear)} mm`)
      reference('car-front-overhang', front, model.vehicle.centerline[1],
        `Vorne · Überhang ${length(front, model.vehicle.centerline[1])} mm`)
      reference('car-track', contacts[0], contacts[1], `Spurbreite ${model.vehicle.trackWidthMm} mm`)
    }
  }
  for (const part of model.mechanical?.parts ?? []) {
    const id = part.id === 'rail-0' ? 'car-guide-a' : part.id === 'rail-1' ? 'car-guide-b' : `car-${part.id}`
    assemblies.push({ ...box(id,part.kind,part.bounds), componentSource: part.source })
  }
  const drive = createCarrierDriveScene(model.drive,'car')
  assemblies.push(...drive.parts)
  return { family: 'car', assemblies, drive }
}
