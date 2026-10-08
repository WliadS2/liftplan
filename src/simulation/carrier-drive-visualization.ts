import type { CarrierDriveModel } from '../elevator/models/carrier-drive-model'
export interface CarrierDriveVisualization {
  readonly concept:CarrierDriveModel['concept']
  readonly counterweight:'available'|'unknown'|'unavailable'
  readonly plunger:'available'|'unknown'|'unavailable'
  readonly suspension:'available'|'unknown'|'unavailable'
}
/** Kinematic display capability only, explicitly separate from drive physics/safety simulation. */
export function getCarrierDriveVisualization(drive:CarrierDriveModel):CarrierDriveVisualization {
  const traction = drive.concept === 'traction',hydraulic = drive.concept === 'hydraulic'
  const counterweight = traction && drive.counterweightTravelRatio !== undefined && drive.parts.some((p)=>p.attachment === 'counterweight')
  const plunger = hydraulic && drive.hydraulic?.plungerPerCarrierRatio !== undefined && drive.parts.some((p)=>p.kind === 'hydraulic-plunger')
  const routes = drive.routes.filter((r)=>r.kind === 'suspension')
  const suspensionExpected = traction || hydraulic && drive.hydraulic?.layout !== 'direct'
  return {concept:drive.concept,counterweight:!traction ? 'unavailable' : counterweight ? 'available' : 'unknown',
    plunger:!hydraulic ? 'unavailable' : plunger ? 'available' : 'unknown',
    suspension:drive.concept === 'unspecified' || !suspensionExpected && !routes.length ? 'unavailable' : routes.length && routes.every((r)=>r.points.every((p)=>
      p.attachment === 'fixed' || p.attachment === 'carrier' || p.attachment === 'counterweight' && counterweight || p.attachment === 'plunger' && plunger))
      ? 'available' : 'unknown'}
}
