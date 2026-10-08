import type { CarrierComponentSource } from '../../../elevator/configuration/carrier-mechanical-planning'
import type { MECHANICAL_MATERIALS } from '../../materials/technical-materials'

/** Optional render-space detail, in metres. Never a planning/collision/persistence model.
 * A future verified component provider can supply these without changing motion ownership. */
export type VisualVector = readonly [number, number, number]
export type VisualMaterial = keyof typeof MECHANICAL_MATERIALS
export type VisualAxis = 'x' | 'y' | 'z'
interface Piece { readonly id: string; readonly center: VisualVector; readonly material: VisualMaterial }
export type MechanicalVisualPiece =
  | (Piece & { readonly kind:'box'; readonly size:VisualVector })
  | (Piece & { readonly kind:'cylinder'; readonly radius:number; readonly length:number; readonly axis:VisualAxis })
  | (Piece & { readonly kind:'revolved'; readonly section:readonly (readonly [number,number])[]; readonly axis:VisualAxis })
  | (Piece & { readonly kind:'profile'; readonly section:readonly (readonly [number,number])[]; readonly length:number; readonly axis:VisualAxis })
export interface MechanicalVisualDetail {
  readonly source:'demo' | 'verified'
  readonly reference:string
  readonly pieces:readonly MechanicalVisualPiece[]
}
export interface MechanicalVisualInput {
  readonly id:string
  readonly kind:string
  readonly size:VisualVector
  readonly componentSource?:CarrierComponentSource
  readonly center?:VisualVector
  readonly guideFacing?:'x-positive' | 'x-negative' | 'z-positive' | 'z-negative'
  readonly relatedRailSize?:VisualVector
  readonly relatedStack?: { readonly center:VisualVector; readonly size:VisualVector }
}

/** Resolve display context only from actual co-located rail envelopes and rail-pair axes.
 * Does not create a guide system or infer engineering contact/clearance rules. */
export function withMechanicalGuideContext(input:MechanicalVisualInput,assemblies:readonly MechanicalVisualInput[]):MechanicalVisualInput {
  const shoes = ['guide-shoe','counterweight-shoe'].includes(input.kind)
  const railKind = input.kind.startsWith('counterweight') ? 'counterweight-rail' : 'guide'
  const rails = assemblies.filter(a=>a.kind === railKind && a.center && a.size.every(v=>v > 0))
  const rail = shoes ? rails.find(a=>input.center && [0,2].every(axis=>Math.abs(input.center![axis]-a.center![axis]) < 1e-9))
    : rails.find(a=>a.id === input.id)
  if (!rail?.center || rails.length !== 2) return input
  const dx = (rails[0].center![0]+rails[1].center![0])/2-rail.center[0]
  const dz = (rails[0].center![2]+rails[1].center![2])/2-rail.center[2]
  if (dx === 0 && dz === 0) return input
  const guideFacing = Math.abs(dx) >= Math.abs(dz) ? dx > 0 ? 'x-positive' : 'x-negative' : dz > 0 ? 'z-positive' : 'z-negative'
  return {...input,guideFacing,relatedRailSize:shoes ? rail.size : undefined}
}

export function withMechanicalVisualContext(input:MechanicalVisualInput,assemblies:readonly MechanicalVisualInput[]):MechanicalVisualInput {
  const contextual = withMechanicalGuideContext(input,assemblies)
  const stack = input.kind === 'counterweight-frame' && input.center ? assemblies.find(a=>a.kind === 'counterweight-stack' && a.center) : undefined
  return stack?.center ? {...contextual,relatedStack:{size:stack.size,
    center:stack.center.map((value,axis)=>value-input.center![axis]) as unknown as VisualVector}} : contextual
}
export interface MechanicalVisualModel {
  readonly componentId:string
  readonly status:'detail' | 'envelope'
  readonly source:CarrierComponentSource | undefined
  readonly reference?:string
  readonly reason?:'missing-detail' | 'invalid-detail' | 'source-mismatch'
  readonly pieces:readonly MechanicalVisualPiece[]
}
export const hasConfiguredMechanicalVisual = (input:MechanicalVisualInput) => input.componentSource !== undefined &&
  ['carrier-frame','floor-structure','guide','guide-shoe','buffer'].includes(input.kind) && input.size.every(v=>v > 0)
const positive = (values:readonly number[]) => values.every(v=>Number.isFinite(v) && v > 0)
const point = (x:number,y:number,z:number):VisualVector => [x,y,z]

/** Profile maps U/V to X/Z about Y, X/-Y about Z, or -Y/Z about X. */
export function visualPieceSize(piece:MechanicalVisualPiece):VisualVector {
  if (piece.kind === 'box') return piece.size
  let transverse:number,other:number,length:number
  if (piece.kind === 'cylinder') {transverse=other=piece.radius*2;length=piece.length}
  else if (piece.kind === 'revolved') {
    transverse=other=Math.max(...piece.section.map(p=>p[0]))*2
    length=Math.max(...piece.section.map(p=>p[1]))-Math.min(...piece.section.map(p=>p[1]))
  } else {
    transverse=Math.max(...piece.section.map(p=>Math.abs(p[0])))*2
    other=Math.max(...piece.section.map(p=>Math.abs(p[1])))*2;length=piece.length
  }
  return piece.axis === 'y' ? point(transverse,length,other)
    : piece.axis === 'z' ? point(transverse,other,length) : point(length,transverse,other)
}

function validPiece(piece:MechanicalVisualPiece) {
  if (!piece.center.every(Number.isFinite)) return false
  if (piece.kind === 'box') return positive(piece.size)
  if (!['x','y','z'].includes(piece.axis)) return false
  if (piece.kind === 'cylinder') return positive([piece.radius,piece.length])
  if (piece.section.length < 3 || piece.section.length > 128 || !piece.section.every(p=>p.every(Number.isFinite))) return false
  const area = piece.section.reduce((sum,p,index)=>{
    const next = piece.section[(index+1)%piece.section.length]
    return sum+p[0]*next[1]-next[0]*p[1]
  },0)
  if (area === 0) return false
  if (piece.kind === 'profile') return positive([piece.length])
  return piece.section.every(p=>p[0] >= 0) && piece.section.some(p=>p[0] > 0) &&
    Math.max(...piece.section.map(p=>p[1])) > Math.min(...piece.section.map(p=>p[1]))
}

/** Reject unusable/oversized embellishment; keep the authoritative envelope fallback.
 * Numerical epsilon is round-off only, not an engineering clearance or tolerance. */
export function prepareMechanicalVisualModel(input:MechanicalVisualInput,detail?:MechanicalVisualDetail):MechanicalVisualModel {
  const fallback = (reason:MechanicalVisualModel['reason']):MechanicalVisualModel => ({componentId:input.id,status:'envelope',
    source:input.componentSource,reason,pieces:[{id:`${input.id}-envelope`,kind:'box',center:[0,0,0],size:input.size,
      material:materialForMechanicalKind(input.kind)}]})
  if (!detail) return fallback('missing-detail')
  if (detail.source === 'demo' && input.componentSource !== 'demo') return fallback('source-mismatch')
  const ids = new Set(detail.pieces.map(p=>p.id))
  if (!positive(input.size) || !detail.reference || !detail.pieces.length || detail.pieces.length > 64 || ids.size !== detail.pieces.length ||
    detail.pieces.some(p=>!p.id || !validPiece(p) || !positive(visualPieceSize(p)) || visualPieceSize(p).some((size,axis)=>{
      const half = size/2
      // Revolved sections can be asymmetric along their axis.
      const axisIndex = p.kind !== 'box' ? ['x','y','z'].indexOf(p.axis) : -1
      const low = p.kind === 'revolved' && axis === axisIndex ? Math.min(...p.section.map(v=>v[1])) : -half
      const high = p.kind === 'revolved' && axis === axisIndex ? Math.max(...p.section.map(v=>v[1])) : half
      return p.center[axis]+low < -input.size[axis]/2-1e-9 || p.center[axis]+high > input.size[axis]/2+1e-9
    }))) return fallback('invalid-detail')
  return {componentId:input.id,status:'detail',source:detail.source,reference:detail.reference,pieces:detail.pieces}
}

export function materialForMechanicalKind(kind:string):VisualMaterial {
  if (['guide','counterweight-rail'].includes(kind)) return 'rail'
  if (['guide-shoe','counterweight-shoe','safety-gear'].includes(kind)) return 'shoe'
  if (kind === 'counterweight-stack') return 'weight'
  if (kind === 'hydraulic-plunger') return 'plunger'
  if (['traction-sheave','hydraulic-pulley'].includes(kind)) return 'sheave'
  if (['machine-support','hydraulic-base','hydraulic-connection'].includes(kind)) return 'support'
  if (['machine','hydraulic-cylinder'].includes(kind)) return 'machine'
  if (kind === 'suspension-hitch') return 'hitch'
  if (kind === 'buffer') return 'buffer'
  return 'frame'
}
