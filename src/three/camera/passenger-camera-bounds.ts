import type { ThreeViewMode } from '../scene/view-mode'
import { createMechanicalBounds, type MechanicalBounds } from '../geometry/passenger/mechanical/passenger-mechanical-layout'
import type { PassengerMechanicalComponentModel } from '../geometry/passenger/mechanical/mechanical-component-model'
import { componentBoxBounds } from '../geometry/passenger/mechanical/mechanical-component-model'
import type { TractionDriveModel } from '../geometry/passenger/mechanical/traction-drive-model'
import type { PassengerSafetyModel } from '../geometry/passenger/mechanical/passenger-safety-model'
import type { DoorInspection, PassengerDoorSystemModel } from '../geometry/passenger/doors/passenger-door-model'
import type { PassengerInstallationModel } from '../geometry/passenger/passenger-installation-model'
import { metres } from '../../engineering'
import type { CameraFrame } from './camera-fit'
import { getSemanticMovingFrame } from './semantic-moving-frame'

export interface PassengerCameraFrame extends CameraFrame {
  readonly bounds: MechanicalBounds
  readonly target: MechanicalBounds['center']
}

const combine = (bounds: readonly (MechanicalBounds | undefined)[]) => createMechanicalBounds(bounds.flatMap((entry) => entry ? [entry.min, entry.max] : []))
const averageCenters = (bounds: readonly (MechanicalBounds | undefined)[], fallback: MechanicalBounds['center']): MechanicalBounds['center'] => {
  const centers = bounds.flatMap((entry) => entry ? [entry.center] : [])
  return centers.length ? centers[0].map((_, axis) => metres(centers.reduce((sum, center) => sum + center[axis], 0) / centers.length)) as unknown as MechanicalBounds['center'] : fallback
}
function installationBounds(model: PassengerInstallationModel): MechanicalBounds {
  const halfWidth = model.bounds.width / 2, halfDepth = model.bounds.depth / 2, halfHeight = model.bounds.height / 2
  return createMechanicalBounds([
    [metres(-halfWidth), metres(model.bounds.centerY - halfHeight), metres(-halfDepth)],
    [metres(halfWidth), metres(model.bounds.centerY + halfHeight), metres(halfDepth)],
  ])
}

/** Presentation-only focus: long rails/ropes must not shrink local assembly inspection. */
export function getPassengerCameraBounds(mode: ThreeViewMode, components: PassengerMechanicalComponentModel, drive: TractionDriveModel, safety?: PassengerSafetyModel, doors?: PassengerDoorSystemModel, inspection?: DoorInspection): MechanicalBounds {
  const localMechanics = [components.carSling?.bounds, components.counterweightFrame?.bounds,
    safety?.linkage?.bounds, ...(safety?.gears.map((g) => g.bounds) ?? []), ...(doors?.cabin.map((d) => d.bounds) ?? []),
    ...components.carGuideShoes.flatMap((s) => s.boxes.map(componentBoxBounds)), ...components.counterweightGuideShoes.flatMap((s) => s.boxes.map(componentBoxBounds)),
  ]
  const topDrive = [drive.machine?.bounds, ...drive.supports.map(componentBoxBounds),
    ...drive.sheaves.filter((s) => s.role === 'traction' || s.role === 'deflection').map((s) => s.bounds), safety?.machineBrake?.bounds]
  const contexts = mode === 'doors' && inspection?.bounds
    ? [inspection.bounds]
    : mode === 'mechanical' && localMechanics.some(Boolean)
    ? localMechanics
    : mode === 'safety' && safety?.bounds
    ? [safety.bounds, components.carSling?.bounds]
    : mode === 'drive' && topDrive.some(Boolean)
      ? topDrive
      : [components.bounds, drive.bounds, safety?.bounds, doors?.bounds]
  return createMechanicalBounds(contexts.flatMap((b) => b ? [b.min, b.max] : []))
}

/** View bounds and orbit target are related but intentionally not identical. */
export function getPassengerCameraFrame(mode: ThreeViewMode, installation: PassengerInstallationModel,
  components: PassengerMechanicalComponentModel, drive: TractionDriveModel, safety?: PassengerSafetyModel,
  doors?: PassengerDoorSystemModel, inspection?: DoorInspection): PassengerCameraFrame {
  const subsystemBounds = getPassengerCameraBounds(mode, components, drive, safety, doors, inspection)
  const completeBounds = combine([installationBounds(installation), components.bounds, drive.bounds, safety?.bounds, doors?.bounds])
  const cabin = installation.cabin
  if (cabin && (mode === 'overview' || mode === 'mechanical' || mode === 'cutaway')) {
    const cabinBounds = createMechanicalBounds([
      [metres(-cabin.width/2), cabin.bottomY, metres(-cabin.depth/2)],
      [metres(cabin.width/2), metres(cabin.bottomY + cabin.height), metres(cabin.depth/2)],
    ])
    const carBounds = combine([cabinBounds, components.carSling?.bounds,
      ...components.carGuideShoes.flatMap((shoe) => shoe.boxes.map(componentBoxBounds)),
      ...doors?.cabin.map((door) => door.bounds) ?? [], safety?.linkage?.bounds])
    const semantic = getSemanticMovingFrame(carBounds, undefined, mode === 'overview' ? completeBounds : undefined)
    return { ...semantic, bounds: createMechanicalBounds([
      semantic.bounds.min.map(metres) as unknown as MechanicalBounds['min'],
      semantic.bounds.max.map(metres) as unknown as MechanicalBounds['max'],
    ]), target: carBounds.center }
  }
  if (mode === 'overview') {
    const region = installation.vertical.travelRegion
    const targetY = region ? (region.bottomY + region.topY) / 2 : installation.cabin?.centerY ?? installation.bounds.centerY
    return { bounds: completeBounds, target: [metres(0), metres(targetY), metres(0)] }
  }
  if (mode === 'cutaway') {
    const cutawayBounds = combine([components.carSling?.bounds, components.counterweightFrame?.bounds,
      safety?.linkage?.bounds, ...doors?.cabin.map((entry) => entry.bounds) ?? []])
    return { bounds: cutawayBounds, target: [metres(0), installation.cabin?.centerY ?? cutawayBounds.centerY, metres(0)] }
  }
  if (mode === 'drive') {
    const driveFocus = [drive.machine?.bounds, ...drive.sheaves.filter((item) => item.role === 'traction' || item.role === 'deflection').map((item) => item.bounds),
      ...drive.supports.map(componentBoxBounds), safety?.machineBrake?.bounds]
    return { bounds: subsystemBounds, target: averageCenters(driveFocus, subsystemBounds.center) }
  }
  if (mode === 'safety') {
    // The governor/tension endpoints define the inspection axis; linkage remains inside the framed route.
    const safetyFocus = safety?.governor && safety?.tension
      ? [safety.governor.bounds, safety.tension.bounds]
      : [safety?.governor?.bounds, safety?.linkage?.bounds, safety?.tension?.bounds, ...safety?.gears.map((item) => item.bounds) ?? []]
    return { bounds: subsystemBounds, target: averageCenters(safetyFocus, subsystemBounds.center) }
  }
  if (mode === 'doors') {
    return { bounds: subsystemBounds, target: inspection?.landing?.bounds.center ?? inspection?.cabin?.bounds.center ?? subsystemBounds.center }
  }
  const mechanicalFocus = [components.carSling?.bounds, components.counterweightFrame?.bounds, safety?.linkage?.bounds]
  return { bounds: subsystemBounds, target: averageCenters(mechanicalFocus, subsystemBounds.center) }
}

export function getPassengerCameraInstallationKey(model: PassengerInstallationModel, components: PassengerMechanicalComponentModel,
  drive: TractionDriveModel, safety?: PassengerSafetyModel, doors?: PassengerDoorSystemModel): string {
  const vertical = model.vertical
  return [model.shaft?.width, model.shaft?.depth, vertical.pitBottomY, vertical.shaftTopY,
    vertical.cabinElevationY, vertical.landingElevations.join(','), !!components.carSling, !!components.counterweightFrame,
    !!drive.machine, !!drive.suspension, !!safety?.governor, !!safety?.tension, !!doors?.bounds].join(':')
}
