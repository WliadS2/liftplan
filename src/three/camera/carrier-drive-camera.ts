import type { CarrierDriveScene } from '../../elevator/models/carrier-drive-scene'
import { driveMotionFactor } from '../geometry/carrier/carrier-drive-motion'
import type { CameraBounds, CameraVector } from './camera-fit'

/** Axis-aligned render-space box (metres). */
export interface DriveCameraBox { readonly min: CameraVector; readonly max: CameraVector }

/** Optional carrier context; `moving` boxes follow the carrier offset of the inspected stop. */
export interface DriveCameraContextBox {
  readonly center: readonly [number, number, number]
  readonly size: readonly [number, number, number]
  readonly moving: boolean
}

/**
 * Presentation-only framing margins (metres). They choose how much surrounding
 * render geometry the Antrieb inspection camera keeps in view; they are not
 * engineering clearances and never alter scene geometry.
 */
export const DRIVE_DETAIL_ADJACENCY_METRES = 1.5
export const DRIVE_DETAIL_CONTEXT_MARGIN_METRES: CameraVector = [0.6, 1, 0.6]

const fromBox = (box: DriveCameraBox): CameraBounds => ({
  min: box.min, max: box.max,
  center: [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2],
  width: box.max[0] - box.min[0], height: box.max[1] - box.min[1], depth: box.max[2] - box.min[2],
})
const union = (boxes: readonly DriveCameraBox[]): DriveCameraBox => ({
  min: [0, 1, 2].map((axis) => Math.min(...boxes.map((box) => box.min[axis]))) as unknown as CameraVector,
  max: [0, 1, 2].map((axis) => Math.max(...boxes.map((box) => box.max[axis]))) as unknown as CameraVector,
})
const clip = (box: DriveCameraBox, window: DriveCameraBox): DriveCameraBox | undefined => {
  const min = [0, 1, 2].map((axis) => Math.max(box.min[axis], window.min[axis]))
  const max = [0, 1, 2].map((axis) => Math.min(box.max[axis], window.max[axis]))
  return min.every((value, axis) => value <= max[axis])
    ? { min: min as unknown as CameraVector, max: max as unknown as CameraVector } : undefined
}
const verticalGap = (box: DriveCameraBox, reference: DriveCameraBox) =>
  Math.max(0, reference.min[1] - box.max[1], box.min[1] - reference.max[1])

/**
 * Traction frames the complete rendered system, including routes and full-height
 * rails. Hydraulic frames the reference carrier connection and nearby fixed base;
 * the existing moving-detail camera translates that frame during travel. Thus the
 * fixed base may leave the local view at upper stops (overview retains everything).
 * No mesh is clipped, shortened or repositioned to improve camera presentation.
 */
export function getCarrierDriveInspectionBounds(drive: CarrierDriveScene | undefined,
  visibleIds: ReadonlySet<string>, carrierOffsetMetres = 0,
  context: readonly DriveCameraContextBox[] = []): CameraBounds | undefined {
  if (!drive) return undefined
  if (drive.concept === 'traction') {
    const travel = drive.carrierTravelMetres ?? 0
    const boxes: DriveCameraBox[] = drive.parts.filter((part)=>visibleIds.has(part.id)).flatMap((part)=>[0,travel].map((offset)=>{
      const shift = (driveMotionFactor(drive,part.driveAttachment) ?? 0)*offset
      return {min:part.center.map((v,i)=>v-part.size[i]/2+(i === 1 ? shift : 0)) as unknown as CameraVector,
        max:part.center.map((v,i)=>v+part.size[i]/2+(i === 1 ? shift : 0)) as unknown as CameraVector}
    }))
    for (const route of drive.routes.filter((r)=>r.kind === 'suspension')) for (const point of route.points) for (const offset of [0,travel]) {
      const position: CameraVector = [point.position[0],point.position[1]+(driveMotionFactor(drive,point.attachment) ?? 0)*offset,point.position[2]]
      boxes.push({min:position,max:position})
    }
    for (const box of context) for (const offset of [0,box.moving ? travel : 0]) boxes.push({
      min:box.center.map((v,i)=>v-box.size[i]/2+(i === 1 ? offset : 0)) as unknown as CameraVector,
      max:box.center.map((v,i)=>v+box.size[i]/2+(i === 1 ? offset : 0)) as unknown as CameraVector,
    })
    return boxes.length ? fromBox(union(boxes)) : undefined
  }
  const posed = drive.parts.filter((part) => visibleIds.has(part.id)).map((part) => {
    const shift = (driveMotionFactor(drive, part.driveAttachment) ?? 0) * carrierOffsetMetres
    const extends_ = part.kind === 'hydraulic-plunger'
    const min = part.center.map((v, i) => v - part.size[i] / 2)
    const max = part.center.map((v, i) => v + part.size[i] / 2)
    if (extends_) max[1] += Math.max(0, shift)
    else { min[1] += shift; max[1] += shift }
    return { part, clipped: extends_ || part.kind === 'counterweight-rail',
      box: { min: min as unknown as CameraVector, max: max as unknown as CameraVector } }
  })
  if (!posed.length) return undefined
  const anchors = posed.filter((entry) => entry.part.driveAttachment === 'fixed' && !entry.clipped)
  const anchor = union((anchors.length ? anchors : posed).map((entry) => entry.box))
  const adjacent = posed.filter((entry) => !entry.clipped && verticalGap(entry.box, anchor) <= DRIVE_DETAIL_ADJACENCY_METRES)
  const subject = union([anchor, ...adjacent.map((entry) => entry.box)])
  const window: DriveCameraBox = {
    min: subject.min.map((v, i) => v - DRIVE_DETAIL_CONTEXT_MARGIN_METRES[i]) as unknown as CameraVector,
    max: subject.max.map((v, i) => v + DRIVE_DETAIL_CONTEXT_MARGIN_METRES[i]) as unknown as CameraVector,
  }
  const contextBoxes: DriveCameraBox[] = context.map((entry) => {
    const shift = entry.moving ? carrierOffsetMetres : 0
    return { min: entry.center.map((v, i) => v - entry.size[i] / 2 + (i === 1 ? shift : 0)) as unknown as CameraVector,
      max: entry.center.map((v, i) => v + entry.size[i] / 2 + (i === 1 ? shift : 0)) as unknown as CameraVector }
  })
  const carrierContext = contextBoxes.filter((_,index)=>context[index].moving)
  const extras = [...posed.filter((entry) => entry.clipped).map((entry) => entry.box), ...contextBoxes.filter((_,index)=>!context[index].moving)]
    .flatMap((box) => clip(box, window) ?? [])
  return fromBox(union([subject, ...carrierContext, ...extras]))
}

/** Carrier offset (metres) of a stop relative to the lowest stop, from scene level markers. */
export function getCarrierOffsetForLevel(levels: readonly { readonly id: string; readonly elevation: number }[],
  levelId: string | undefined): number {
  if (!levels.length || levelId === undefined) return 0
  const lowest = Math.min(...levels.map((level) => level.elevation))
  const level = levels.find((entry) => entry.id === levelId)
  return level ? level.elevation - lowest : 0
}
