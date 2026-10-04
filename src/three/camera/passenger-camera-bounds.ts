import type { ThreeViewMode } from '../scene/view-mode'
import { createMechanicalBounds, type MechanicalBounds } from '../geometry/passenger/mechanical/passenger-mechanical-layout'
import type { PassengerMechanicalComponentModel } from '../geometry/passenger/mechanical/mechanical-component-model'
import { componentBoxBounds, componentCylinderBounds } from '../geometry/passenger/mechanical/mechanical-component-model'
import type { TractionDriveModel } from '../geometry/passenger/mechanical/traction-drive-model'
import type { PassengerSafetyModel } from '../geometry/passenger/mechanical/passenger-safety-model'
import type { DoorInspection, PassengerDoorSystemModel } from '../geometry/passenger/doors/passenger-door-model'

/** Presentation-only focus: long rails/ropes must not shrink local assembly inspection. */
export function getPassengerCameraBounds(mode: ThreeViewMode, components: PassengerMechanicalComponentModel, drive: TractionDriveModel, safety?: PassengerSafetyModel, doors?: PassengerDoorSystemModel, inspection?: DoorInspection): MechanicalBounds {
  const localMechanics = [components.carSling?.bounds, components.counterweightFrame?.bounds,
    safety?.tension?.bounds, safety?.linkage?.bounds, ...(safety?.gears.map((g) => g.bounds) ?? []), ...(doors?.cabin.map((d) => d.bounds) ?? []),
    ...components.carGuideShoes.flatMap((s) => s.boxes.map(componentBoxBounds)), ...components.counterweightGuideShoes.flatMap((s) => s.boxes.map(componentBoxBounds)),
    ...[components.carBuffers, components.counterweightBuffers].flatMap((b) => b ? [...b.boxes.map(componentBoxBounds), ...b.cylinders.map(componentCylinderBounds)] : [])]
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
