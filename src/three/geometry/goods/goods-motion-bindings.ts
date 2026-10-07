import { millimetresToMetres, type Metres } from '../../../engineering'
import type { GoodsSceneBox, GoodsLiftSceneModel } from '../../../elevator/goods/goods-lift-scene-model'
import type { GoodsSimulationPose } from '../../../simulation/goods-simulation'

const movingKinds = new Set<GoodsSceneBox['kind']>([
  'platform', 'platform-floor', 'platform-roof', 'platform-wall', 'door',
  'pallet', 'roll-container', 'forklift-envelope',
])
/** Only actual carrier attachments move. Rail axes, levels, shaft and swept bounds remain fixed. */
export const isGoodsMovingAssembly = (assembly: GoodsSceneBox) => movingKinds.has(assembly.kind)
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
  return scene.assemblies.flatMap((a) => a.doorAttachment ? [{
    id: a.id, role: a.doorAttachment.role,
    levelId: a.doorAttachment.role === 'landing' ? a.doorAttachment.levelId : undefined,
    side: a.doorAttachment.side, center: a.center,
    width: a.size[0], height: a.size[1], source: 'visualization',
  } as const] : [])
}
export function getGoodsDoorProgress(door: GoodsVisualDoorLayout, pose?: GoodsSimulationPose): number {
  if (!pose || (door.role === 'landing' && door.levelId !== pose.activeLandingLevel)) return 0
  return door.side === 'front' ? pose.frontDoorProgress : pose.rearDoorProgress
}
export function getGoodsDoorPanelOffsets(door: GoodsVisualDoorLayout, pose?: GoodsSimulationPose): readonly [number, number] {
  const travel = door.width / 2 * getGoodsDoorProgress(door, pose)
  return [-travel, travel]
}
export function getGoodsAssemblyPosition(assembly: GoodsSceneBox, pose: GoodsSimulationPose): readonly [number, number, number] {
  return [assembly.center[0], assembly.center[1] +
    (isGoodsMovingAssembly(assembly) ? millimetresToMetres(pose.platformOffsetMm) : 0), assembly.center[2]]
}
