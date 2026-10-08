import type { MechanicalVisualModel } from '../../mechanical/mechanical-visual-model'
import type { ComponentBox } from './mechanical-component-model'

/** Adapter for already explicit Passenger shapes. No synthetic subdivision or replacement
 * geometry: original mesh parents retain position, rotation, scale and stable identifiers. */
export function createPassengerBoxVisualModel(parts:readonly ComponentBox[]):MechanicalVisualModel {
  return {componentId:'passenger-explicit-boxes',status:'detail',source:undefined,pieces:parts.map(part=>({
    id:part.id,kind:'box',center:[0,0,0],size:part.size,material:part.material,
  }))}
}
