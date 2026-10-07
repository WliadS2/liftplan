import { millimetresToMetres } from '../../../engineering'
import type { PlatformSimulationPose } from '../../../simulation/platform-simulation'
import { getCarrierDoorPanelOffsets, type CarrierDoorLayout } from './carrier-door-model'

/** Render bindings only. One rigid carrier translation; landing structures never receive it. */
export function getCarrierMotionTransforms(movingGroupName: string, doors: readonly CarrierDoorLayout[], pose?: PlatformSimulationPose) {
  return [{ nodeName:movingGroupName, axis:'y' as const, offset:pose ? millimetresToMetres(pose.platformOffsetMm) : 0 },
    ...doors.flatMap((door)=>getCarrierDoorPanelOffsets(door,pose).map((offset,index)=>({
      nodeName:`${door.id}-panel-motion-${index}`,axis:'x' as const,offset,
    }))) ]
}
