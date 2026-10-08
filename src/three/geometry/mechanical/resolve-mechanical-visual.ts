import { createDemoMechanicalVisualDetail,demoDriveRouteDiameter } from '../../../dev/fixtures/mechanical-visual-detail'
import type { CarrierDriveScene } from '../../../elevator/models/carrier-drive-scene'
import { prepareMechanicalVisualModel,type MechanicalVisualDetail,type MechanicalVisualInput } from './mechanical-visual-model'

/** Production never synthesizes hardware detail. Supplied verified detail is a future
 * component-provider boundary; no asset loading or planning default is implemented. */
export function resolveMechanicalVisual(input:MechanicalVisualInput,supplied?:MechanicalVisualDetail,development=import.meta.env.DEV) {
  return prepareMechanicalVisualModel(input,supplied ?? (import.meta.env.DEV && development ? createDemoMechanicalVisualDetail(input) : undefined))
}

export function resolveDriveRouteDiameter(drive:CarrierDriveScene,id:string,development=import.meta.env.DEV):number | undefined {
  return import.meta.env.DEV && development && drive.parts.length > 0 && drive.parts.every(p=>p.componentSource === 'demo') ? demoDriveRouteDiameter(id) : undefined
}
