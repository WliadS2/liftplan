import { metres, type Metres } from '../engineering'
import type { PassengerGeometryPlanningInput } from '../three/geometry/lift-geometry-planning-input'
import type { PassengerInstallationModel } from '../three/geometry/passenger/passenger-installation-model'
import type { PassengerDoorSystemModel } from '../three/geometry/passenger/doors/passenger-door-model'
import {
  componentBoxBounds,
  componentCylinderBounds,
  type BufferComponentModel,
  type PassengerMechanicalComponentModel,
} from '../three/geometry/passenger/mechanical/mechanical-component-model'
import type { MechanicalBounds, PassengerMechanicalLayout } from '../three/geometry/passenger/mechanical/passenger-mechanical-layout'
import type { TractionDriveModel } from '../three/geometry/passenger/mechanical/traction-drive-model'
import type { PassengerSafetyModel } from '../three/geometry/passenger/mechanical/passenger-safety-model'
import {
  createVerticalSweptAabb,
  unionAabbs,
  type AxisAlignedBoundingBox,
  type AxisAlignedPlanRectangle,
} from './spatial-primitives'

export type PassengerSpatialSubsystem = 'installation' | 'shaft' | 'cabin' | 'levels' | 'car-frame'
  | 'car-rails' | 'counterweight' | 'counterweight-rails' | 'doors' | 'buffers'
  | 'traction' | 'safety' | 'movement'

export interface SpatialEnvelope {
  readonly id: string
  readonly subsystem: PassengerSpatialSubsystem
  readonly componentIds: readonly string[]
  readonly plan: AxisAlignedPlanRectangle
  readonly bounds?: AxisAlignedBoundingBox
}

export interface PassengerSpatialMotionContext {
  readonly counterweightCenterEnvelope?: {
    readonly minY: Metres
    readonly maxY: Metres
  }
  readonly fixedObstacles?: readonly SpatialEnvelope[]
}

export interface PassengerSpatialGeometryInputs {
  readonly planning: PassengerGeometryPlanningInput
  readonly installation: PassengerInstallationModel
  readonly layout: PassengerMechanicalLayout
  readonly components: PassengerMechanicalComponentModel
  readonly drive: TractionDriveModel
  readonly safety: PassengerSafetyModel
  readonly doors: PassengerDoorSystemModel
}

export interface PassengerSpatialEnvelopes {
  readonly shaftInterior?: SpatialEnvelope
  readonly cabin?: SpatialEnvelope
  readonly cabinSweep?: SpatialEnvelope
  readonly carFrame?: SpatialEnvelope
  readonly carFrameSweep?: SpatialEnvelope
  readonly counterweight?: SpatialEnvelope
  readonly counterweightSweep?: SpatialEnvelope
  readonly carRails?: SpatialEnvelope
  readonly counterweightRails?: SpatialEnvelope
  readonly cabinDoors: readonly SpatialEnvelope[]
  readonly landingDoors: readonly SpatialEnvelope[]
  readonly buffers: readonly SpatialEnvelope[]
  readonly upperMechanical: readonly SpatialEnvelope[]
  readonly fixedObstacles: readonly SpatialEnvelope[]
}

const toAabb = (bounds: MechanicalBounds): AxisAlignedBoundingBox => ({ min: bounds.min, max: bounds.max })
const plan = (minX: number, maxX: number, minZ: number, maxZ: number): AxisAlignedPlanRectangle => ({
  minX: metres(minX), maxX: metres(maxX), minZ: metres(minZ), maxZ: metres(maxZ),
})
const envelope = (
  id: string,
  subsystem: PassengerSpatialSubsystem,
  bounds: AxisAlignedBoundingBox,
  componentIds: readonly string[] = [id],
): SpatialEnvelope => ({
  id,
  subsystem,
  componentIds,
  bounds,
  plan: plan(bounds.min[0], bounds.max[0], bounds.min[2], bounds.max[2]),
})

function bufferEnvelope(buffer: BufferComponentModel): SpatialEnvelope | undefined {
  const bounds = unionAabbs([
    ...buffer.boxes.map((part) => toAabb(componentBoxBounds(part))),
    ...buffer.cylinders.map((part) => toAabb(componentCylinderBounds(part))),
  ])
  return bounds ? envelope(`${buffer.kind}-buffers`, 'buffers', bounds,
    [...buffer.boxes.map((part) => part.id), ...buffer.cylinders.map((part) => part.id)]) : undefined
}

export function createPassengerSpatialEnvelopes(
  inputs: PassengerSpatialGeometryInputs,
  motion: PassengerSpatialMotionContext = {},
): PassengerSpatialEnvelopes {
  const { installation, layout, components, drive, safety, doors } = inputs
  const shaft = installation.shaft
  const shaftBounds = shaft?.verticalExtent ? {
    min: [metres(-shaft.width / 2), shaft.verticalExtent.bottomY, metres(-shaft.depth / 2)] as const,
    max: [metres(shaft.width / 2), shaft.verticalExtent.topY, metres(shaft.depth / 2)] as const,
  } : undefined
  const shaftInterior = shaft ? {
    id: 'shaft-interior', subsystem: 'shaft' as const, componentIds: ['shaft'],
    plan: plan(-shaft.width / 2, shaft.width / 2, -shaft.depth / 2, shaft.depth / 2),
    bounds: shaftBounds,
  } : undefined
  const cabinModel = installation.cabin
  const cabinBounds = cabinModel ? {
    min: [metres(-cabinModel.width / 2), cabinModel.bottomY, metres(-cabinModel.depth / 2)] as const,
    max: [metres(cabinModel.width / 2), metres(cabinModel.bottomY + cabinModel.height), metres(cabinModel.depth / 2)] as const,
  } : undefined
  const cabin = cabinBounds ? envelope('cabin', 'cabin', cabinBounds) : undefined
  const region = installation.vertical.travelRegion
  const cabinSweepBounds = cabinBounds && region
    ? createVerticalSweptAabb(cabinBounds, metres(region.bottomY - cabinModel!.bottomY), metres(region.topY - cabinModel!.bottomY))
    : undefined
  const carFrame = layout.carFrame ? envelope('car-frame', 'car-frame', toAabb(layout.carFrame.bounds),
    ['car-frame', ...layout.carFrame.uprights.map((entry) => entry.id), layout.carFrame.crosshead.id, layout.carFrame.lowerSling.id]) : undefined
  const carFrameSweepBounds = carFrame?.bounds && region && cabinModel
    ? createVerticalSweptAabb(carFrame.bounds, metres(region.bottomY - cabinModel.bottomY), metres(region.topY - cabinModel.bottomY))
    : undefined
  const counterweight = layout.counterweight ? envelope('counterweight', 'counterweight', toAabb(layout.counterweight.bounds)) : undefined
  const counterweightSweepBounds = counterweight?.bounds && motion.counterweightCenterEnvelope && layout.counterweight
    ? createVerticalSweptAabb(counterweight.bounds,
      metres(motion.counterweightCenterEnvelope.minY - layout.counterweight.center[1]),
      metres(motion.counterweightCenterEnvelope.maxY - layout.counterweight.center[1]))
    : undefined
  const rails = (kind: 'car' | 'counterweight') => {
    const system = kind === 'car' ? layout.carRails : layout.counterweightRails
    if (!system) return undefined
    const bounds = unionAabbs(system.rails.map((rail) => ({
      min: rail.start.map((value, axis) => metres(Math.min(value, rail.end[axis]))) as unknown as typeof rail.start,
      max: rail.start.map((value, axis) => metres(Math.max(value, rail.end[axis]))) as unknown as typeof rail.start,
    })))!
    return envelope(`${kind}-rails`, kind === 'car' ? 'car-rails' : 'counterweight-rails', bounds, system.rails.map((rail) => rail.id))
  }
  const doorEnvelope = (role: 'cabin' | 'landing') => (role === 'cabin' ? doors.cabin : doors.landings)
    .map((entry) => envelope(entry.id, 'doors', toAabb(entry.bounds),
      [entry.id, ...entry.panels.map((panel) => panel.id)]))
  const buffers = [components.carBuffers, components.counterweightBuffers]
    .flatMap((entry) => entry ? [bufferEnvelope(entry)] : [])
    .filter((entry): entry is SpatialEnvelope => !!entry)
  const upperMechanical = [
    ...(drive.machine ? [envelope('traction-machine', 'traction', toAabb(drive.machine.bounds),
      ['traction-machine', ...drive.machine.boxes.map((part) => part.id)])] : []),
    ...drive.sheaves.map((sheave) => envelope(sheave.id, 'traction', toAabb(sheave.bounds))),
    ...(safety.governor ? [envelope('governor', 'safety', toAabb(safety.governor.bounds))] : []),
  ]
  return {
    shaftInterior,
    cabin,
    cabinSweep: cabinSweepBounds ? envelope('cabin-sweep', 'movement', cabinSweepBounds, ['cabin']) : undefined,
    carFrame,
    carFrameSweep: carFrameSweepBounds && carFrame ? envelope('car-frame-sweep', 'movement', carFrameSweepBounds, carFrame.componentIds) : undefined,
    counterweight,
    counterweightSweep: counterweightSweepBounds ? envelope('counterweight-sweep', 'movement', counterweightSweepBounds, ['counterweight']) : undefined,
    carRails: rails('car'),
    counterweightRails: rails('counterweight'),
    cabinDoors: doorEnvelope('cabin'),
    landingDoors: doorEnvelope('landing'),
    buffers,
    upperMechanical,
    fixedObstacles: [...upperMechanical, ...(motion.fixedObstacles ?? [])],
  }
}
