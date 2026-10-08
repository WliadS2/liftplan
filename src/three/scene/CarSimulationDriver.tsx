import type { ReactNode } from 'react'
import type { PlatformSimulationController } from '../../simulation/platform-simulation'
import type { CarrierDoorLayout } from '../geometry/carrier/carrier-door-model'
import { CarrierSimulationDriver } from './CarrierSimulationDriver'
import type { CarrierDriveScene } from '../../elevator/models/carrier-drive-scene'

export function CarSimulationDriver(props: {
  readonly controller?: PlatformSimulationController; readonly doors: readonly CarrierDoorLayout[]; readonly children: ReactNode
  readonly drive?:CarrierDriveScene
}) {
  return <CarrierSimulationDriver {...props} movingGroupName="car-moving-assembly" />
}
