import { millimetres as mm, type Millimetres } from '../../engineering'
import type { CarrierMechanicalPlanning, CarrierComponentSource } from '../configuration/carrier-mechanical-planning'

export interface CarrierBoxMm {
  readonly minX: Millimetres; readonly maxX: Millimetres
  readonly minY: Millimetres; readonly maxY: Millimetres
  readonly minZ: Millimetres; readonly maxZ: Millimetres
}
export interface CarrierMechanicalPart {
  readonly id: string
  readonly kind: 'carrier-frame' | 'floor-structure' | 'guide' | 'guide-shoe' | 'buffer'
  readonly attachment: 'moving' | 'fixed'
  readonly source: CarrierComponentSource
  readonly bounds: CarrierBoxMm
}
export interface CarrierMechanicalModel {
  readonly parts: readonly CarrierMechanicalPart[]
  readonly issues: readonly { readonly code: 'invalid-component' | 'missing-reference'; readonly path: string }[]
}
interface Inputs {
  readonly platform?: CarrierBoxMm
  readonly shaft?: CarrierBoxMm
  readonly guideSystem?: { readonly orientation: 'x' | 'z'; readonly spacingMm: Millimetres }
}
const positive = (...values: number[]) => values.every((v) => Number.isFinite(v) && v > 0)

/** Family-neutral section construction in mm; no passenger installation or drive assumptions.
 * Floor/frame datum = usable platform floor; buffers = explicit pit-floor positions.
 * Invalid components remain explicit issues; unrelated platform/shaft geometry survives. */
export function normalizeCarrierMechanics(data: CarrierMechanicalPlanning | undefined, input: Inputs): CarrierMechanicalModel {
  const parts: CarrierMechanicalPart[] = [], issues: CarrierMechanicalModel['issues'][number][] = []
  if (!data) return { parts, issues }
  const p = input.platform, shaft = input.shaft, guides = input.guideSystem
  const issue = (path: string, missing = false) => issues.push({ code: missing ? 'missing-reference' : 'invalid-component', path })
  const add = (id: string, kind: CarrierMechanicalPart['kind'], center: readonly number[], size: readonly number[]) => {
    parts.push({ id, kind, source: data.source, attachment: ['guide', 'buffer'].includes(kind) ? 'fixed' : 'moving',
      bounds: { minX: mm(center[0]-size[0]/2), maxX: mm(center[0]+size[0]/2),
        minY: mm(center[1]-size[1]/2), maxY: mm(center[1]+size[1]/2),
        minZ: mm(center[2]-size[2]/2), maxZ: mm(center[2]+size[2]/2) } })
  }
  const floor = data.floorThicknessMm
  if (floor !== undefined) {
    if (!p) issue('mechanical.floorThicknessMm', true)
    else if (!positive(floor)) issue('mechanical.floorThicknessMm')
    else add('floor-structure', 'floor-structure', [(p.minX+p.maxX)/2,p.minY-floor/2,(p.minZ+p.maxZ)/2],
      [p.maxX-p.minX,floor,p.maxZ-p.minZ])
  }
  const frame = data.frame
  if (frame) {
    if (!p || floor === undefined) issue('mechanical.frame', true)
    else if (!positive(floor, frame.spacingMm, frame.uprightWidthMm, frame.uprightDepthMm,
      frame.lowerMemberHeightMm, frame.upperMemberHeightMm)) issue('mechanical.frame')
    else {
      const bottom = p.minY-floor-frame.lowerMemberHeightMm, top = p.maxY+frame.upperMemberHeightMm
      const xPair = frame.orientation === 'x'
      for (const [index, sign] of [-1,1].entries()) add(`frame-upright-${index}`, 'carrier-frame',
        [xPair ? sign*frame.spacingMm/2 : 0,(bottom+top)/2,xPair ? 0 : sign*frame.spacingMm/2],
        [frame.uprightWidthMm,top-bottom,frame.uprightDepthMm])
      const span = frame.spacingMm+(xPair ? frame.uprightWidthMm : frame.uprightDepthMm)
      for (const [label,y,height] of [
        ['lower',bottom+frame.lowerMemberHeightMm/2,frame.lowerMemberHeightMm],
        ['upper',p.maxY+frame.upperMemberHeightMm/2,frame.upperMemberHeightMm],
      ] as const) add(`frame-${label}`, 'carrier-frame', [0,y,0],
        [xPair ? span : frame.uprightWidthMm,height,xPair ? frame.uprightDepthMm : span])
    }
  }
  if (data.rails) {
    if (!guides || !shaft) issue('mechanical.rails', true)
    else if (!positive(data.rails.widthMm,data.rails.depthMm,shaft.maxY-shaft.minY)) issue('mechanical.rails')
    else for (const [index,sign] of [-1,1].entries()) add(`rail-${index}`, 'guide',
      [guides.orientation === 'x' ? sign*guides.spacingMm/2 : 0,(shaft.minY+shaft.maxY)/2,
        guides.orientation === 'z' ? sign*guides.spacingMm/2 : 0],
      [data.rails.widthMm,shaft.maxY-shaft.minY,data.rails.depthMm])
  }
  const shoes = data.shoes
  if (shoes) {
    if (!guides || !p) issue('mechanical.shoes', true)
    else if (!positive(shoes.widthMm,shoes.heightMm,shoes.depthMm) ||
      ![shoes.lowerInsetMm,shoes.upperInsetMm].every((v)=>Number.isFinite(v) && v >= 0) ||
      shoes.lowerInsetMm+shoes.upperInsetMm+shoes.heightMm > p.maxY-p.minY) issue('mechanical.shoes')
    else for (const [index,sign] of [-1,1].entries()) {
      for (const [label,y] of [['lower',p.minY+shoes.lowerInsetMm+shoes.heightMm/2],
        ['upper',p.maxY-shoes.upperInsetMm-shoes.heightMm/2]] as const) add(`shoe-${index}-${label}`, 'guide-shoe',
        [guides.orientation === 'x' ? sign*guides.spacingMm/2 : 0,y,guides.orientation === 'z' ? sign*guides.spacingMm/2 : 0],
        [shoes.widthMm,shoes.heightMm,shoes.depthMm])
    }
  }
  const ids = new Set<string>()
  for (const buffer of data.buffers ?? []) {
    const path = `mechanical.buffers.${buffer.id}`
    if (!shaft || !p) { issue(path, true); continue }
    const segments = [
      ['base',buffer.baseWidthMm,buffer.baseHeightMm,buffer.baseDepthMm],
      ['body',buffer.bodyWidthMm,buffer.bodyHeightMm,buffer.bodyDepthMm],
      ['contact',buffer.contactWidthMm,buffer.contactHeightMm,buffer.contactDepthMm],
    ] as const
    if (ids.has(buffer.id) || ![buffer.xMm,buffer.zMm].every(Number.isFinite) ||
      !segments.every(([,w,h,d])=>positive(w,h,d))) { issue(path); continue }
    ids.add(buffer.id)
    let y: number = shaft.minY
    // Actual declared pit bounds, not a regulatory buffer height/clearance rule.
    if (y+segments.reduce((sum,[,,h])=>sum+h,0) > p.minY || segments.some(([,w,,d])=>
      buffer.xMm-w/2 < shaft.minX || buffer.xMm+w/2 > shaft.maxX ||
      buffer.zMm-d/2 < shaft.minZ || buffer.zMm+d/2 > shaft.maxZ)) { issue(path); continue }
    for (const [label,w,h,d] of segments) {
      add(`buffer-${buffer.id}-${label}`, 'buffer', [buffer.xMm,y+h/2,buffer.zMm], [w,h,d]); y += h
    }
  }
  return { parts, issues }
}
