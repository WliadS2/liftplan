import { millimetres as mm } from '../engineering'
import type { CarrierBoxMm, CarrierMechanicalModel } from '../elevator/models/carrier-mechanical-model'
import { driveAttachmentOffset, drivePartBoundsAtOffset, type CarrierDriveModel, type CarrierDrivePart } from '../elevator/models/carrier-drive-model'
import { carrierBoxesPenetrate } from './carrier-mechanical-validation'

export interface DriveSpatialRule {
  readonly ruleId: string; readonly status: 'ok' | 'unknown' | 'invalid'
  readonly involvedComponentIds: readonly string[]; readonly blocksTravel: boolean
  readonly reason: string
  readonly measurementsMm?: Readonly<Record<string, number>>
}
interface Input {
  readonly shaft?: CarrierBoxMm; readonly platform?: CarrierBoxMm
  readonly mechanical?: CarrierMechanicalModel
  readonly levels: readonly { readonly elevationMm: number }[]
}
const contains = (a: CarrierBoxMm,b: CarrierBoxMm) => b.minX >= a.minX && b.maxX <= a.maxX &&
  b.minY >= a.minY && b.maxY <= a.maxY && b.minZ >= a.minZ && b.maxZ <= a.maxZ
const union = (a: CarrierBoxMm,b: CarrierBoxMm): CarrierBoxMm => ({
  minX:mm(Math.min(a.minX,b.minX)),maxX:mm(Math.max(a.maxX,b.maxX)),minY:mm(Math.min(a.minY,b.minY)),maxY:mm(Math.max(a.maxY,b.maxY)),
  minZ:mm(Math.min(a.minZ,b.minZ)),maxZ:mm(Math.max(a.maxZ,b.maxZ)),
})
export const carrierBoxOverlapMm = (a: CarrierBoxMm,b: CarrierBoxMm) => ({
  x:Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX),y:Math.min(a.maxY,b.maxY)-Math.max(a.minY,b.minY),
  z:Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ),
})

/** Pure spatial checks, never meshes or regulatory clearances. Intentional declared rail interfaces
 * and cylinder/plunger nesting are not free-obstacle tests. All other penetration is strict 3-axis. */
export function validateCarrierDrive(model: CarrierDriveModel, input: Input): readonly DriveSpatialRule[] {
  const rules: DriveSpatialRule[] = []
  const add = (ruleId: string,status: DriveSpatialRule['status'],ids: readonly string[],reason: string,blocksTravel = false,
    measurementsMm?: DriveSpatialRule['measurementsMm']) => rules.push({ruleId:`drive.${ruleId}`,status,
      involvedComponentIds:ids,reason,blocksTravel:status === 'invalid' && blocksTravel,measurementsMm})
  const parts = model.parts, shaft = input.shaft, p = input.platform
  const travel = p && input.levels.length > 1 ? input.levels.at(-1)!.elevationMm-p.minY : undefined
  const sweep = (part: CarrierDrivePart) => {
    if (part.attachment === 'fixed') return part.bounds
    if (travel === undefined) return undefined
    const end = drivePartBoundsAtOffset(model,part,travel)
    return end ? union(part.bounds,end) : undefined
  }
  add('concept',model.concept === 'unspecified' ? 'unknown' : 'ok',[],model.concept === 'unspecified' ? 'concept-missing' : 'explicit-concept')
  model.issues.forEach((i)=>add(`input.${i.path}`,i.code === 'missing-reference' ? 'unknown' : 'invalid',[i.path],i.code))
  const expected = model.concept === 'traction' ? ['machine','traction-sheave','suspension-hitch','counterweight-frame','counterweight-stack','counterweight-rail']
    : model.concept === 'hydraulic' ? ['hydraulic-cylinder','hydraulic-plunger','hydraulic-base','hydraulic-connection'] : []
  for (const kind of expected) if (!parts.some((part)=>part.kind === kind)) add(`available.${kind}`,'unknown',[],`${kind}-missing`)
  if (model.concept === 'traction') add('counterweight.motion',model.counterweightTravelRatio === undefined ? 'unknown' : 'ok',
    parts.filter((part)=>part.attachment === 'counterweight').map((part)=>part.id),'explicit-motion-relation')
  if (model.concept === 'hydraulic') {
    const h = model.hydraulic
    if (h?.layout === undefined || h.plungerPerCarrierRatio === undefined || h.availableStrokeMm === undefined || travel === undefined) {
      add('hydraulic.stroke','unknown',[],'travel-data-missing')
    } else {
      const required = travel*h.plungerPerCarrierRatio
      add('hydraulic.stroke',h.availableStrokeMm >= required ? 'ok' : 'invalid',
        parts.filter((part)=>part.kind === 'hydraulic-plunger').map((part)=>part.id),'declared-stroke-containment',true,
        {required,available:h.availableStrokeMm})
    }
    if (h?.layout === 'indirect' && (!parts.some((part)=>part.kind === 'hydraulic-pulley') || !model.routes.some((r)=>r.kind === 'suspension'))) {
      add('hydraulic.indirect','unknown',[],'pulley-or-route-missing')
    }
    const cylinder = parts.find((part)=>part.kind === 'hydraulic-cylinder'), plunger = parts.find((part)=>part.kind === 'hydraulic-plunger')
    const connection = parts.find((part)=>part.kind === 'hydraulic-connection')
    if (!cylinder || !plunger) add('hydraulic.alignment','unknown',[],'cylinder-plunger-missing')
    else add('hydraulic.alignment',plunger.bounds.minX >= cylinder.bounds.minX && plunger.bounds.maxX <= cylinder.bounds.maxX &&
      plunger.bounds.minZ >= cylinder.bounds.minZ && plunger.bounds.maxZ <= cylinder.bounds.maxZ &&
      Math.min(plunger.bounds.maxY,cylinder.bounds.maxY) >= Math.max(plunger.bounds.minY,cylinder.bounds.minY) ? 'ok' : 'invalid',
      [cylinder.id,plunger.id],'declared-cylinder-plunger-alignment',true)
    if (h?.layout === 'direct') {
      if (!plunger || !connection || travel === undefined || h.plungerPerCarrierRatio === undefined) add('hydraulic.connection','unknown',[],'connection-motion-missing')
      else {
        const contact = (offset: number) => {
          const rod = drivePartBoundsAtOffset(model,plunger,offset)!, joint = drivePartBoundsAtOffset(model,connection,offset)!
          return rod.minX >= joint.minX && rod.maxX <= joint.maxX && rod.minZ >= joint.minZ && rod.maxZ <= joint.maxZ &&
            rod.maxY >= joint.minY && rod.maxY <= joint.maxY
        }
        add('hydraulic.connection',contact(0) && contact(travel) ? 'ok' : 'invalid',[plunger.id,connection.id],'direct-endpoint-alignment',true)
      }
    }
  }
  for (const part of parts) {
    const volume = sweep(part)
    if (!shaft || !volume) add(`shaft.${part.id}`,'unknown',[part.id],'shaft-or-motion-missing')
    // A fixed part outside the declared building envelope is invalid planning geometry,
    // but only the moving-obstacle tests below can establish that it blocks travel.
    else add(`shaft.${part.id}`,contains(shaft,volume) ? 'ok' : 'invalid',[part.id,'shaft'],'swept-shaft-containment',part.attachment !== 'fixed')
    if (part.railId) {
      const rail = parts.find((r)=>r.id === part.railId && r.kind === 'counterweight-rail') ?? input.mechanical?.parts.find((r)=>r.id === part.railId && r.kind === 'guide')
      if (!rail) add(`engagement.${part.id}`,'unknown',[part.id,part.railId],'rail-reference-missing')
      else {
        // Intersection/contact establishes the declared geometric interface, not certified engagement.
        const end = travel === undefined ? undefined : drivePartBoundsAtOffset(model,part,travel)
        const overlap = carrierBoxOverlapMm(part.bounds,rail.bounds)
        const fits = (bounds: CarrierBoxMm) => bounds.minY >= rail.bounds.minY && bounds.maxY <= rail.bounds.maxY &&
          Object.values(carrierBoxOverlapMm(bounds,rail.bounds)).every((v)=>v >= 0)
        add(`engagement.${part.id}`,!fits(part.bounds) || (end && !fits(end)) ? 'invalid' : !end ? 'unknown' : 'ok',
          [part.id,part.railId],'declared-rail-interface',true,overlap)
      }
    }
    if (p && part.attachment === 'carrier' && carrierBoxesPenetrate(part.bounds,p)) add(`interior.${part.id}`,'invalid',
      [part.id,'platform'],'carrier-interior-penetration',true,carrierBoxOverlapMm(part.bounds,p))
    if (part.attachment === 'fixed') for (const fixed of input.mechanical?.parts.filter((part)=>part.attachment === 'fixed') ?? []) {
      if (carrierBoxesPenetrate(part.bounds,fixed.bounds)) add(`static.${part.id}.${fixed.id}`,'invalid',[part.id,fixed.id],
        'fixed-component-penetration',false,carrierBoxOverlapMm(part.bounds,fixed.bounds))
    }
  }
  if (p && travel !== undefined) {
    const carriers: { readonly id: string; readonly kind?: string; readonly bounds: CarrierBoxMm }[] = [{id:'platform',bounds:{...p,maxY:mm(p.maxY+travel)}},
      ...input.mechanical?.parts.filter((part)=>part.attachment === 'moving').map((part)=>({id:part.id,kind:part.kind,
        bounds:{...part.bounds,maxY:mm(part.bounds.maxY+travel)}})) ?? [],
      ...parts.filter((part)=>part.attachment === 'carrier').map((part)=>({id:part.id,kind:part.kind,bounds:sweep(part)!}))]
    const counterweight = parts.filter((part)=>part.attachment === 'counterweight')
    const fixed = [...parts.filter((part)=>part.attachment === 'fixed'),
      ...input.mechanical?.parts.filter((part)=>part.attachment === 'fixed') ?? []]
    for (const subject of [...carriers,...counterweight.flatMap((part)=>sweep(part) ? [{...part,bounds:sweep(part)!}] : [])]) {
      for (const obstacle of fixed) {
        if (('kind' in subject && (subject.kind === 'guide-shoe' || subject.kind === 'safety-gear') && obstacle.kind === 'guide') ||
          ('railId' in subject && subject.railId === obstacle.id)) continue
        if (carrierBoxesPenetrate(subject.bounds,obstacle.bounds)) add(`obstacle.${subject.id}.${obstacle.id}`,'invalid',
          [subject.id,obstacle.id],'fixed-obstacle-penetration',true,carrierBoxOverlapMm(subject.bounds,obstacle.bounds))
      }
    }
    for (const cw of counterweight) {
      const volume = sweep(cw)
      if (!volume) continue
      for (const car of carriers) if (carrierBoxesPenetrate(volume,car.bounds)) add(`counterweight.carrier.${cw.id}.${car.id}`,'invalid',
        [cw.id,car.id],'swept-penetration',true,carrierBoxOverlapMm(volume,car.bounds))
    }
    for (const rod of parts.filter((part)=>part.kind === 'hydraulic-plunger')) {
      const volume = sweep(rod)
      if (!volume) continue
      const obstacles = [...carriers.filter((part)=>part.kind !== 'hydraulic-connection' && part.kind !== 'hydraulic-pulley'),
        ...fixed.filter((part)=>part.kind !== 'hydraulic-cylinder' && part.kind !== 'hydraulic-base')]
      for (const obstacle of obstacles) if (carrierBoxesPenetrate(volume,obstacle.bounds)) add(`plunger.obstacle.${obstacle.id}`,'invalid',
        [rod.id,obstacle.id],'fixed-obstacle-penetration',true,carrierBoxOverlapMm(volume,obstacle.bounds))
    }
  } else if (parts.length) add('obstacles','unknown',[],'carrier-travel-missing')
  for (const route of model.routes) {
    if (travel === undefined || !shaft || route.points.some((point)=>driveAttachmentOffset(model,point.attachment,travel) === undefined)) {
      add(`route.${route.id}`,'unknown',[route.id],'route-motion-or-shaft-missing'); continue
    }
    let contained = true, nonzero = true, attached = true, referenceMissing = false
    // Linear attachment motion can collapse a segment between the endpoint poses.
    // Equal X/Z is necessary; a Y sign change then proves a zero-length crossing.
    for (let index=1;index<route.points.length;index++) {
      const a = route.points[index-1], b = route.points[index]
      if (a.x !== b.x || a.z !== b.z) continue
      const initial = b.y-a.y
      const final = initial+driveAttachmentOffset(model,b.attachment,travel)!-driveAttachmentOffset(model,a.attachment,travel)!
      if (initial*final <= 0) nonzero=false
    }
    for (const offset of [0,travel]) {
      const points = route.points.map((point)=>({...point,y:point.y+driveAttachmentOffset(model,point.attachment,offset)!}))
      points.forEach((point,index)=>{
        if (point.x < shaft.minX || point.x > shaft.maxX || point.y < shaft.minY || point.y > shaft.maxY || point.z < shaft.minZ || point.z > shaft.maxZ) contained = false
        if (index && point.x === points[index-1].x && point.y === points[index-1].y && point.z === points[index-1].z) nonzero = false
      })
      // Both leg ends must be anchored to actual declared attachment envelopes; fixed interior
      // waypoints may be schematic sheave-route points, not calculated wrapping geometry.
      if (route.kind === 'suspension') for (const point of [points[0],points.at(-1)!]) {
        const anchors = parts.filter((part)=>part.attachment === point.attachment &&
          ['suspension-hitch','traction-sheave','hydraulic-pulley','hydraulic-connection','hydraulic-plunger'].includes(part.kind))
        if (!anchors.length) referenceMissing = true
        else if (!anchors.some((part)=>{
          const b = drivePartBoundsAtOffset(model,part,offset)!
          return point.x >= b.minX && point.x <= b.maxX && point.y >= b.minY && point.y <= b.maxY && point.z >= b.minZ && point.z <= b.maxZ
        })) attached = false
      }
    }
    add(`route.${route.id}`,!contained || !nonzero || !attached ? 'invalid' : referenceMissing ? 'unknown' : 'ok',[route.id],
      !contained ? 'route-outside-shaft' : !nonzero ? 'zero-length-segment' : !attached ? 'detached-endpoint' : referenceMissing ? 'anchor-missing' : 'explicit-route',true)
  }
  const rails = parts.filter((part)=>part.kind === 'counterweight-rail')
  for (let i=0;i<rails.length;i++) for (let j=i+1;j<rails.length;j++) if (carrierBoxesPenetrate(rails[i].bounds,rails[j].bounds)) {
    add(`rails.${rails[i].id}.${rails[j].id}`,'invalid',[rails[i].id,rails[j].id],'fixed-component-penetration',true)
  }
  if (model.concept === 'traction' && !model.routes.some((r)=>r.kind === 'suspension')) add('suspension','unknown',[],'route-missing')
  if (!parts.some((part)=>part.kind === 'safety-gear')) add('safety.gears','unknown',[],'safety-data-missing')
  if (!model.routes.some((r)=>r.kind === 'monitoring')) add('safety.monitoring','unknown',[],'monitoring-data-missing')
  return rules
}
