import { millimetres as mm, type Millimetres } from '../../engineering'
import type { CarrierBoxMm } from './carrier-mechanical-model'
import type { CarrierComponentSource } from '../configuration/carrier-mechanical-planning'
import type { CarrierDrivePlanning, CarrierSafetyPlanning, DriveAttachment, DriveBoxPlanning, DriveConcept, DriveRoutePlanning } from '../configuration/carrier-drive-planning'

export type DrivePartKind = 'machine' | 'machine-support' | 'traction-sheave' | 'suspension-hitch' |
  'counterweight-frame' | 'counterweight-stack' | 'counterweight-rail' | 'counterweight-shoe' |
  'hydraulic-cylinder' | 'hydraulic-plunger' | 'hydraulic-base' | 'hydraulic-connection' | 'hydraulic-pulley' | 'safety-gear'
export interface CarrierDrivePart extends DriveBoxPlanning {
  readonly kind: DrivePartKind; readonly attachment: DriveAttachment
  readonly source: CarrierComponentSource; readonly railId?: string
}
export interface CarrierDriveModel {
  readonly concept: DriveConcept
  readonly carrierTravelMm?: Millimetres
  readonly parts: readonly CarrierDrivePart[]
  readonly routes: readonly (DriveRoutePlanning & { readonly kind: 'suspension' | 'monitoring' })[]
  readonly counterweightTravelRatio?: number
  readonly hydraulic?: { readonly layout?: 'direct' | 'indirect'; readonly plungerPerCarrierRatio?: number; readonly availableStrokeMm?: number }
  readonly issues: readonly { readonly code: 'invalid-component' | 'invalid-relation' | 'missing-reference'; readonly path: string }[]
}

/** Explicit component envelopes in domain mm, independent of either family/Passenger/Three.js. */
export function normalizeCarrierDrive(data?: CarrierDrivePlanning, safety?: CarrierSafetyPlanning,
  references?: { readonly levels:readonly {readonly elevationMm:number}[]; readonly shaft?:CarrierBoxMm }): CarrierDriveModel {
  const parts: CarrierDrivePart[] = [], routes: CarrierDriveModel['routes'][number][] = [], issues: CarrierDriveModel['issues'][number][] = []
  const ids = new Set<string>()
  const positive = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value > 0
  const resolveY = (reference: DriveBoxPlanning['verticalReference']) => reference === undefined ? 0
    : reference === 'lowest-stop' ? references?.levels[0]?.elevationMm : references?.levels.at(-1)?.elevationMm
  const add = (value: DriveBoxPlanning | undefined, kind: DrivePartKind, attachment: DriveAttachment, source: CarrierComponentSource, railId?: string) => {
    if (!value) return
    const y = resolveY(value.verticalReference)
    if (y === undefined || (value.verticalSpan && !references?.shaft)) { issues.push({code:'missing-reference',path:value.id}); return }
    const b = {...value.bounds,minY:value.verticalSpan ? references!.shaft!.minY : mm(value.bounds.minY+y),
      maxY:value.verticalSpan ? references!.shaft!.maxY : mm(value.bounds.maxY+y)}
    if (ids.has(value.id) || !Object.values(b).every(Number.isFinite) || b.maxX <= b.minX || b.maxY <= b.minY || b.maxZ <= b.minZ) {
      issues.push({ code: 'invalid-component', path: value.id }); return
    }
    ids.add(value.id); parts.push({ ...value, bounds:b, kind, attachment, source, railId })
  }
  const addRoutes = (values: readonly DriveRoutePlanning[] | undefined, kind: 'suspension' | 'monitoring') => {
    for (const route of values ?? []) {
      if (route.points.some((p)=>resolveY(p.verticalReference) === undefined)) { issues.push({code:'missing-reference',path:route.id}); continue }
      if (ids.has(route.id) || route.points.length < 2 || route.points.some((p)=>![p.x,p.y,p.z].every(Number.isFinite))) {
        issues.push({ code: 'invalid-component', path: route.id }); continue
      }
      ids.add(route.id); routes.push({ ...route, points:route.points.map((p)=>({...p,y:mm(p.y+resolveY(p.verticalReference)!)})), kind })
    }
  }
  if (data?.concept === 'traction') {
    add(data.machine,'machine','fixed',data.source)
    data.supports?.forEach((p)=>add(p,'machine-support','fixed',data.source))
    data.sheaves?.forEach((p)=>add(p,'traction-sheave','fixed',data.source))
    data.carrierHitches?.forEach((p)=>add(p,'suspension-hitch','carrier',data.source))
    const cw = data.counterweight
    add(cw?.frame,'counterweight-frame','counterweight',data.source)
    add(cw?.stack,'counterweight-stack','counterweight',data.source)
    cw?.rails?.forEach((p)=>add(p,'counterweight-rail','fixed',data.source))
    cw?.shoes?.forEach((p)=>add(p,'counterweight-shoe','counterweight',data.source,p.railId))
    cw?.hitches?.forEach((p)=>add(p,'suspension-hitch','counterweight',data.source))
    if (cw?.travelRatio !== undefined && !positive(cw.travelRatio)) issues.push({ code: 'invalid-relation', path: 'drive.counterweight.travelRatio' })
    addRoutes(data.suspension,'suspension')
  }
  if (data?.concept === 'hydraulic') {
    add(data.cylinder,'hydraulic-cylinder','fixed',data.source)
    add(data.base,'hydraulic-base','fixed',data.source)
    add(data.plunger,'hydraulic-plunger','plunger',data.source)
    add(data.connection,'hydraulic-connection','carrier',data.source)
    if (data.pulley) add(data.pulley,'hydraulic-pulley',data.pulley.attachment,data.source)
    if ((data.travel?.plungerPerCarrierRatio !== undefined && !positive(data.travel.plungerPerCarrierRatio)) ||
      (data.travel?.availableStrokeMm !== undefined && (!Number.isFinite(data.travel.availableStrokeMm) || data.travel.availableStrokeMm < 0))) issues.push({ code: 'invalid-relation', path: 'drive.travel' })
    addRoutes(data.suspension,'suspension')
  }
  safety?.gears?.forEach((p)=>add(p,'safety-gear','carrier',safety.source,p.railId))
  addRoutes(safety?.monitoringPaths,'monitoring')
  return { concept: data?.concept ?? 'unspecified', parts, routes, issues,
    carrierTravelMm:references && references.levels.length > 1
      ? mm(references.levels.at(-1)!.elevationMm-references.levels[0].elevationMm) : undefined,
    counterweightTravelRatio: data?.concept === 'traction' && positive(data.counterweight?.travelRatio) ? data.counterweight!.travelRatio : undefined,
    hydraulic: data?.concept === 'hydraulic' ? { layout:data.layout,
      plungerPerCarrierRatio:positive(data.travel?.plungerPerCarrierRatio) ? data.travel!.plungerPerCarrierRatio : undefined,
      availableStrokeMm:data.travel?.availableStrokeMm !== undefined && Number.isFinite(data.travel.availableStrokeMm) && data.travel.availableStrokeMm >= 0
        ? data.travel.availableStrokeMm : undefined } : undefined }
}

export function driveAttachmentOffset(model: CarrierDriveModel, attachment: DriveAttachment, carrierOffsetMm: number): number | undefined {
  if (attachment === 'fixed') return 0
  if (attachment === 'carrier') return carrierOffsetMm
  if (attachment === 'counterweight') return model.counterweightTravelRatio === undefined ? undefined : -carrierOffsetMm*model.counterweightTravelRatio
  return model.hydraulic?.plungerPerCarrierRatio === undefined ? undefined : carrierOffsetMm*model.hydraulic.plungerPerCarrierRatio
}
export function drivePartBoundsAtOffset(model: CarrierDriveModel, part: CarrierDrivePart, offsetMm: number): CarrierBoxMm | undefined {
  const offset = driveAttachmentOffset(model,part.attachment,offsetMm)
  if (offset === undefined) return undefined
  return { ...part.bounds, minY: part.kind === 'hydraulic-plunger' ? part.bounds.minY : mm(part.bounds.minY+offset), maxY:mm(part.bounds.maxY+offset) }
}
