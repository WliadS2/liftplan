import { millimetresToMetres, type Metres } from '../../../engineering'
import type { GoodsSceneBox, GoodsLiftSceneModel } from '../../../elevator/goods/goods-lift-scene-model'
import type { GoodsSimulationPose } from '../../../simulation/goods-simulation'
import { createCarrierDoorLayouts, getCarrierDoorProgress, getCarrierDoorPanelOffsets } from '../carrier/carrier-door-model'

const movingKinds = new Set<GoodsSceneBox['kind']>([
  'platform', 'platform-floor', 'platform-roof', 'platform-wall', 'door',
  'pallet', 'roll-container', 'forklift-envelope',
  'carrier-frame', 'floor-structure', 'guide-shoe',
])
/** Only actual carrier attachments move. Rail axes, levels, shaft and swept bounds remain fixed. */
export const isGoodsMovingAssembly = (assembly: GoodsSceneBox) => assembly.driveAttachment === 'carrier' || movingKinds.has(assembly.kind)
export interface GoodsVisualDoorLayout {
  readonly id: string
  readonly role: 'platform' | 'landing'
  readonly levelId?: string
  readonly side: 'front' | 'rear'
  readonly center: GoodsSceneBox['center']
  readonly width: Metres
  readonly height: Metres
  readonly source: 'visualization'
}
/** Schematic two-leaf sliding symbols, not a manufacturer mechanism or new usable-opening dimension. */
export function createGoodsVisualDoorLayouts(scene: GoodsLiftSceneModel): readonly GoodsVisualDoorLayout[] {
  return createCarrierDoorLayouts(scene.assemblies)
}
export function getGoodsDoorProgress(door: GoodsVisualDoorLayout, pose?: GoodsSimulationPose): number {
  return getCarrierDoorProgress(door,pose)
}
export function getGoodsDoorPanelOffsets(door: GoodsVisualDoorLayout, pose?: GoodsSimulationPose): readonly [number, number] {
  return getCarrierDoorPanelOffsets(door,pose)
}
export function getGoodsAssemblyPosition(assembly: GoodsSceneBox, pose: GoodsSimulationPose): readonly [number, number, number] {
  return [assembly.center[0], assembly.center[1] +
    (isGoodsMovingAssembly(assembly) ? millimetresToMetres(pose.platformOffsetMm) : 0), assembly.center[2]]
}
