import type { CarrierDriveScene } from '../../../elevator/models/carrier-drive-scene'
import type { DriveAttachment } from '../../../elevator/configuration/carrier-drive-planning'

/** Render-neutral coefficients compiled once per normalized scene; no simulation engine or timing. */
export function driveMotionFactor(drive:CarrierDriveScene,attachment:DriveAttachment):number | undefined {
  if (attachment === 'fixed') return 0
  if (attachment === 'carrier') return 1
  if (attachment === 'counterweight') return drive.counterweightTravelRatio === undefined ? undefined : -drive.counterweightTravelRatio
  return drive.plungerPerCarrierRatio
}
export function createCarrierDriveMotionPlan(drive?:CarrierDriveScene) {
  return { parts:drive?.parts.map((part)=>({id:part.id,factor:driveMotionFactor(drive,part.driveAttachment),
    extends:part.kind === 'hydraulic-plunger',centerY:part.center[1],height:part.size[1]})) ?? [],
    routes:drive?.routes.map((route)=>({id:route.id,points:route.points.map((point)=>({
      base:point.position,factor:driveMotionFactor(drive,point.attachment)}))})) ?? [] }
}
