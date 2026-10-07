import type { Metres } from '../../../engineering'
import type { PlatformSimulationPose } from '../../../simulation/platform-simulation'

export interface CarrierDoorLayout {
  readonly id: string
  readonly role: 'platform' | 'landing'
  readonly side: 'front' | 'rear'
  readonly levelId?: string
  readonly center: readonly [Metres,Metres,Metres]
  readonly width: Metres
  readonly height: Metres
  readonly source: 'visualization'
}
interface DoorReference {
  readonly id: string
  readonly center: CarrierDoorLayout['center']
  readonly size: readonly [Metres,Metres,Metres]
  readonly doorAttachment?: { readonly role: 'platform' | 'landing'; readonly side: 'front' | 'rear'; readonly levelId?: string }
}
/** Known opening geometry only. The two-leaf symbol does not select a manufactured door type. */
export function createCarrierDoorLayouts(assemblies: readonly DoorReference[]): readonly CarrierDoorLayout[] {
  return assemblies.flatMap((a)=>a.doorAttachment ? [{ id: a.id, ...a.doorAttachment,
    center: a.center, width: a.size[0], height: a.size[1], source: 'visualization' as const }] : [])
}
export function getCarrierDoorProgress(door: CarrierDoorLayout, pose?: PlatformSimulationPose): number {
  if (!pose || (door.role === 'landing' && door.levelId !== pose.activeLandingLevel)) return 0
  return door.side === 'front' ? pose.frontDoorProgress : pose.rearDoorProgress
}
export function getCarrierDoorPanelOffsets(door: CarrierDoorLayout, pose?: PlatformSimulationPose): readonly [number,number] {
  const travel = door.width/2 * getCarrierDoorProgress(door,pose)
  return [-travel,travel]
}
