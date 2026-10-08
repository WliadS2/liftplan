import type { ReactNode } from 'react'
import type { GoodsSimulationController } from '../../simulation/goods-simulation'
import type { GoodsVisualDoorLayout } from '../geometry/goods/goods-motion-bindings'
import { CarrierSimulationDriver } from './CarrierSimulationDriver'
import type { CarrierDriveScene } from '../../elevator/models/carrier-drive-scene'

/** One clock, one moving attachment group; domain models are never rebuilt per frame. */
export function GoodsSimulationDriver(props: {
  readonly controller?: GoodsSimulationController; readonly doors: readonly GoodsVisualDoorLayout[]; readonly children: ReactNode
  readonly drive?:CarrierDriveScene
}) {
  return <CarrierSimulationDriver {...props} movingGroupName="goods-moving-assembly" />
}
