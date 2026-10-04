import type { ThreeViewMode } from '../scene/view-mode'
import { createMechanicalBounds, type MechanicalBounds } from '../geometry/passenger/mechanical/passenger-mechanical-layout'
import type { PassengerMechanicalComponentModel } from '../geometry/passenger/mechanical/mechanical-component-model'
import type { TractionDriveModel } from '../geometry/passenger/mechanical/traction-drive-model'
import { drivePoint } from '../geometry/passenger/mechanical/drive-geometry'
import type { PassengerSafetyModel } from '../geometry/passenger/mechanical/passenger-safety-model'

/** Camera-only context: upper frame halves retain attachment context without framing pit/rail tails. */
export function getPassengerCameraBounds(mode: ThreeViewMode, components: PassengerMechanicalComponentModel, drive: TractionDriveModel, safety?: PassengerSafetyModel): MechanicalBounds {
  const upperHalf = (bounds: MechanicalBounds | undefined) => bounds
    ? createMechanicalBounds([drivePoint(bounds.min[0], bounds.centerY, bounds.min[2]), bounds.max])
    : undefined
  const contexts = mode === 'safety' && safety?.bounds
    ? [safety.bounds, components.carSling?.bounds]
    : mode === 'drive' && drive.bounds
      ? [drive.bounds, safety?.machineBrake?.bounds, upperHalf(components.carSling?.bounds), upperHalf(components.counterweightFrame?.bounds)]
      : [components.bounds, drive.bounds, safety?.bounds]
  return createMechanicalBounds(contexts.flatMap((b) => b ? [b.min, b.max] : []))
}
