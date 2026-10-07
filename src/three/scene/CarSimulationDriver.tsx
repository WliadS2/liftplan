import type { ReactNode } from 'react'
import type { PlatformSimulationController } from '../../simulation/platform-simulation'
import type { CarrierDoorLayout } from '../geometry/carrier/carrier-door-model'
import { CarrierSimulationDriver } from './CarrierSimulationDriver'

export function CarSimulationDriver(props: {
  readonly controller?: PlatformSimulationController; readonly doors: readonly CarrierDoorLayout[]; readonly children: ReactNode
}) {
  return <CarrierSimulationDriver {...props} movingGroupName="car-moving-assembly" />
}
