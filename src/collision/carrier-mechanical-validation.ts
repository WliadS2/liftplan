import { millimetres as mm } from '../engineering'
import type { CarrierBoxMm, CarrierMechanicalModel } from '../elevator/models/carrier-mechanical-model'

export interface CarrierMechanicalConflict {
  readonly code: 'component-invalid' | 'component-reference-missing' | 'component-outside-shaft' | 'component-interior-penetration' | 'fixed-component-penetration'
  readonly involvedComponentIds: readonly string[]
}
const contains = (a: CarrierBoxMm,b: CarrierBoxMm) =>
  b.minX >= a.minX && b.maxX <= a.maxX && b.minY >= a.minY && b.maxY <= a.maxY && b.minZ >= a.minZ && b.maxZ <= a.maxZ
/** Strict three-axis penetration; boundary contact is not a collision. */
export const carrierBoxesPenetrate = (a: CarrierBoxMm,b: CarrierBoxMm) =>
  Math.min(a.maxX,b.maxX) > Math.max(a.minX,b.minX) && Math.min(a.maxY,b.maxY) > Math.max(a.minY,b.minY) &&
  Math.min(a.maxZ,b.maxZ) > Math.max(a.minZ,b.minZ)

export function validateCarrierMechanics(mechanical: CarrierMechanicalModel | undefined, shaft: CarrierBoxMm | undefined,
  platform: CarrierBoxMm | undefined, levels: readonly { readonly elevationMm: number }[]): readonly CarrierMechanicalConflict[] {
  if (!mechanical) return []
  const conflicts: CarrierMechanicalConflict[] = mechanical.issues.map((issue)=>({
    code: issue.code === 'missing-reference' ? 'component-reference-missing' : 'component-invalid', involvedComponentIds: [issue.path],
  }))
  if (!shaft || !platform || !levels.length) return conflicts
  const offset = levels.at(-1)!.elevationMm-platform.minY
  const sweep = (bounds: CarrierBoxMm): CarrierBoxMm => ({ ...bounds, maxY: mm(bounds.maxY+offset) })
  const moving = mechanical.parts.filter((p)=>p.attachment === 'moving')
  const fixed = mechanical.parts.filter((p)=>p.attachment === 'fixed')
  for (const part of moving) {
    if (part.kind !== 'floor-structure' && carrierBoxesPenetrate(part.bounds,platform)) {
      conflicts.push({code:'component-interior-penetration',involvedComponentIds:[part.id,'platform']})
    }
  }
  for (const part of mechanical.parts) {
    if (!contains(shaft,part.attachment === 'moving' ? sweep(part.bounds) : part.bounds)) {
      conflicts.push({ code: 'component-outside-shaft', involvedComponentIds: [part.id,'shaft'] })
    }
  }
  // Shoes intentionally surround their guide axes. This relationship is not a free-obstacle test.
  // Frame/floor/platform are never exempt from penetrating an explicit rail or pit buffer.
  const swept = [{ id: 'platform', bounds: sweep(platform) },
    ...moving.map((p)=>({ id:p.id,kind:p.kind,bounds:sweep(p.bounds) }))]
  for (const obstacle of fixed) for (const subject of swept) {
    if ('kind' in subject && subject.kind === 'guide-shoe' && obstacle.kind === 'guide') continue
    if (carrierBoxesPenetrate(subject.bounds,obstacle.bounds)) conflicts.push({ code: 'fixed-component-penetration',
      involvedComponentIds: [subject.id,obstacle.id] })
  }
  return conflicts
}
