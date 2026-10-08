import { millimetres as mm, millimetresToMetres as toMetres, type Metres } from '../../engineering'
import type { DriveAttachment } from '../configuration/carrier-drive-planning'
import { driveAttachmentOffset, type CarrierDriveModel, type DrivePartKind } from './carrier-drive-model'
import type { CarrierComponentSource } from '../configuration/carrier-mechanical-planning'

export interface DriveSceneBox {
  readonly id: string; readonly kind: DrivePartKind; readonly driveAttachment: DriveAttachment
  readonly center: readonly [Metres,Metres,Metres]; readonly size: readonly [Metres,Metres,Metres]
  readonly componentSource: CarrierComponentSource
}
export interface CarrierDriveScene {
  readonly concept: CarrierDriveModel['concept']
  readonly carrierTravelMetres?: Metres
  readonly counterweightTravelRatio?: number
  readonly plungerPerCarrierRatio?: number
  readonly parts: readonly DriveSceneBox[]
  readonly routes: readonly { readonly id: string; readonly kind: 'suspension' | 'monitoring';
    readonly points: readonly { readonly position: readonly [Metres,Metres,Metres]; readonly attachment: DriveAttachment }[] }[]
}
/** Sole explicit mm -> m boundary for the shared mechanical drive primitives. */
export function createCarrierDriveScene(model: CarrierDriveModel,family: 'goods' | 'car'): CarrierDriveScene {
  return { concept:model.concept,counterweightTravelRatio:model.counterweightTravelRatio,
    carrierTravelMetres:model.carrierTravelMm === undefined ? undefined : toMetres(mm(model.carrierTravelMm)),
    plungerPerCarrierRatio:model.hydraulic?.plungerPerCarrierRatio,
    parts:model.parts.map((p)=>({id:`${family}-${p.id}`,kind:p.kind,driveAttachment:p.attachment,componentSource:p.source,
      center:[toMetres(mm((p.bounds.minX+p.bounds.maxX)/2)),toMetres(mm((p.bounds.minY+p.bounds.maxY)/2)),toMetres(mm((p.bounds.minZ+p.bounds.maxZ)/2))],
      size:[toMetres(mm(p.bounds.maxX-p.bounds.minX)),toMetres(mm(p.bounds.maxY-p.bounds.minY)),toMetres(mm(p.bounds.maxZ-p.bounds.minZ))]})),
    // An unresolved motion relation must not render a rope with one frozen, detached end.
    routes:model.routes.filter((r)=>r.points.every((p)=>driveAttachmentOffset(model,p.attachment,0) !== undefined))
      .map((r)=>({id:`${family}-${r.id}`,kind:r.kind,points:r.points.map((p)=>({position:[toMetres(p.x),toMetres(p.y),toMetres(p.z)],attachment:p.attachment}))})) }
}
