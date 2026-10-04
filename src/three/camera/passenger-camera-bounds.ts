import type { ThreeViewMode } from '../scene/view-mode'
import { createMechanicalBounds, type MechanicalBounds } from '../geometry/passenger/mechanical/passenger-mechanical-layout'
import type { PassengerMechanicalComponentModel } from '../geometry/passenger/mechanical/mechanical-component-model'
import type { TractionDriveModel } from '../geometry/passenger/mechanical/traction-drive-model'
import { drivePoint } from '../geometry/passenger/mechanical/drive-geometry'

/** Camera-only context: upper frame halves retain attachment context without framing pit/rail tails. */
export function getPassengerCameraBounds(mode: ThreeViewMode, components: PassengerMechanicalComponentModel, drive: TractionDriveModel): MechanicalBounds {
  const upperHalf = (bounds: MechanicalBounds | undefined) => bounds
    ? createMechanicalBounds([drivePoint(bounds.min[0], bounds.centerY, bounds.min[2]), bounds.max])
    : undefined
  const contexts = mode === 'drive' && drive.bounds
    ? [drive.bounds, upperHalf(components.carSling?.bounds), upperHalf(components.counterweightFrame?.bounds)]
    : [components.bounds, drive.bounds]
  return createMechanicalBounds(contexts.flatMap((b) => b ? [b.min, b.max] : []))
}
