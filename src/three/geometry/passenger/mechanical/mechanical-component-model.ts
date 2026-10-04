import type {
  BufferComponentData, CarSlingData, ComponentDataSource, CounterweightFrameData,
  MechanicalComponentData, SlidingGuideShoeData,
} from '../../../../elevator/configuration/mechanical-component-data'
import { metres, millimetresToMetres, type Metres } from '../../../../engineering'
import {
  createMechanicalBounds,
  type MechanicalBounds, type MechanicalPoint, type PassengerMechanicalLayout,
  type PassengerRailSystemLayout,
} from './passenger-mechanical-layout'
import { createTRailProfile, type TRailProfile } from './rail-profile'

export type MechanicalMaterialRole = 'frame' | 'rail' | 'weight' | 'shoe' | 'liner' | 'buffer' | 'plunger'
  | 'machine' | 'support' | 'sheave' | 'rope' | 'hitch'
export interface ComponentBox {
  readonly id: string
  readonly source: ComponentDataSource
  readonly material: MechanicalMaterialRole
  readonly center: MechanicalPoint
  readonly size: MechanicalPoint
  readonly rotationY: number
}
export interface ComponentCylinder {
  readonly id: string
  readonly source: ComponentDataSource
  readonly material: MechanicalMaterialRole
  readonly center: MechanicalPoint
  readonly radius: Metres
  readonly height: Metres
}
export interface DetailedRail {
  readonly id: string
  readonly profile: TRailProfile
  readonly origin: MechanicalPoint
  readonly length: Metres
  readonly rotationY: number
  readonly facing: MechanicalPoint
}
export interface GuideShoeModel {
  readonly id: string
  readonly railId: string
  readonly source: ComponentDataSource
  readonly reference?: string
  readonly railAxis: MechanicalPoint
  readonly rotationY: number
  readonly mountingCenter: MechanicalPoint
  readonly boxes: readonly ComponentBox[]
}
export interface StructuralAssemblyModel {
  readonly source: ComponentDataSource
  readonly reference?: string
  readonly boxes: readonly ComponentBox[]
  readonly bounds: MechanicalBounds
}
export interface CounterweightComponentModel extends StructuralAssemblyModel {
  readonly stackBounds: MechanicalBounds
  readonly slabs: readonly ComponentBox[]
}
export interface BufferComponentModel {
  readonly kind: 'car' | 'counterweight'
  readonly source: ComponentDataSource
  readonly reference?: string
  readonly boxes: readonly ComponentBox[]
  readonly cylinders: readonly ComponentCylinder[]
}
export interface ComponentGeometryIssue {
  readonly code: 'invalid-component-shape'
  readonly path: string
}
export interface PassengerMechanicalComponentModel {
  readonly carRails?: readonly DetailedRail[]
  readonly counterweightRails?: readonly DetailedRail[]
  readonly carSling?: StructuralAssemblyModel
  readonly counterweightFrame?: CounterweightComponentModel
  readonly carGuideShoes: readonly GuideShoeModel[]
  readonly counterweightGuideShoes: readonly GuideShoeModel[]
  readonly carBuffers?: BufferComponentModel
  readonly counterweightBuffers?: BufferComponentModel
  readonly bounds: MechanicalBounds
  readonly missingData: readonly string[]
  readonly issues: readonly ComponentGeometryIssue[]
}

const point = (x: number, y: number, z: number): MechanicalPoint => [metres(x), metres(y), metres(z)]
const mm = millimetresToMetres
const positive = (values: readonly number[]) => values.every((v) => Number.isFinite(v) && v > 0)
const nonNegative = (values: readonly number[]) => values.every((v) => Number.isFinite(v) && v >= 0)
function positiveDimensions(data: object, exclude: readonly string[] = []): boolean {
  return positive(Object.entries(data)
    .filter(([key]) => key.endsWith('Mm') && !exclude.includes(key))
    .map(([, value]) => value as number))
}
// Numerical comparison only, not a manufactured tolerance or engineering clearance.
const sameCoordinate = (a: number, b: number) => Math.abs(a - b) < Number.EPSILON * 32

function localToWorld(local: MechanicalPoint, center: MechanicalPoint, rotationY: number): MechanicalPoint {
  const c = Math.cos(rotationY), s = Math.sin(rotationY)
  return point(center[0] + c * local[0] + s * local[2], center[1] + local[1], center[2] - s * local[0] + c * local[2])
}
function box(id: string, source: ComponentDataSource, material: MechanicalMaterialRole,
  center: MechanicalPoint, size: MechanicalPoint, rotationY = 0): ComponentBox {
  return { id, source, material, center, size, rotationY }
}
export function componentBoxBounds(part: ComponentBox): MechanicalBounds {
  const points = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) =>
    localToWorld(point(x * part.size[0] / 2, y * part.size[1] / 2, z * part.size[2] / 2), part.center, part.rotationY))))
  return createMechanicalBounds(points)
}
function boxesBounds(boxes: readonly ComponentBox[]): MechanicalBounds {
  return createMechanicalBounds(boxes.flatMap((part) => {
    const bounds = componentBoxBounds(part)
    return [bounds.min, bounds.max]
  }))
}
function intersects(a: MechanicalBounds, b: MechanicalBounds): boolean {
  return [0, 1, 2].every((axis) => a.min[axis] < b.max[axis] - Number.EPSILON * 32 && a.max[axis] > b.min[axis] + Number.EPSILON * 32)
}

/** Three box strips form one reusable open channel, without overlapping coplanar faces. */
function channel(id: string, source: ComponentDataSource, center: MechanicalPoint,
  size: MechanicalPoint, wall: Metres, rotationY = 0): ComponentBox[] {
  const [w, h, d] = size
  const at = (local: MechanicalPoint) => localToWorld(local, center, rotationY)
  return [
    box(`${id}-web`, source, 'frame', at(point(0, 0, -d / 2 + wall / 2)), point(w, h, wall), rotationY),
    ...[-1, 1].map((sign) => box(`${id}-flange-${sign}`, source, 'frame',
      at(point(sign * (w / 2 - wall / 2), 0, wall / 2)), point(wall, h, d - wall), rotationY)),
  ]
}

function railPair(system: PassengerRailSystemLayout, target: MechanicalPoint, profile: TRailProfile): DetailedRail[] {
  return system.rails.map((rail) => {
    // Layout has already established a transverse pair. Aim the profile head at that assembly.
    const dx = target[0] - rail.start[0], dz = target[2] - rail.start[2]
    const rotationY = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dz > 0 ? 0 : Math.PI)
    return { id: rail.id, profile, origin: rail.start,
      length: metres(rail.end[1] - rail.start[1]), rotationY,
      facing: point(Math.sin(rotationY), 0, Math.cos(rotationY)),
    }
  })
}

function createCarSling(data: CarSlingData, layout: PassengerMechanicalLayout): StructuralAssemblyModel | undefined {
  const frame = layout.carFrame
  if (!frame) return undefined
  const { source } = data
  if (!positiveDimensions(data)) return undefined
  const w = mm(data.uprightWidthMm), d = mm(data.uprightDepthMm), t = mm(data.channelWallThicknessMm)
  const upper = mm(data.crossheadHeightMm), lower = mm(data.lowerMemberHeightMm)
  const crossDepth = mm(data.crossheadDepthMm), offset = mm(data.railToUprightCentreMm)
  const supportW = mm(data.platformMemberWidthMm), supportH = mm(data.platformMemberHeightMm)
  if (2 * t >= Math.min(w, d, crossDepth) || supportW > w) return undefined
  const axis = frame.orientation === 'x' ? 0 : 2
  const other = axis === 0 ? 2 : 0
  const rotation = axis === 0 ? 0 : Math.PI / 2
  const sorted = [...frame.uprights].sort((a, b) => a.start[axis] - b.start[axis])
  const centres = sorted.map((r, i) => r.start[axis] + (i === 0 ? 1 : -1) * offset)
  const bottom = frame.cabinBounds.min[1], top = frame.cabinBounds.max[1]
  const transverse = sorted[0].start[other]
  const span = centres[1] - centres[0] + w
  if (span <= 2 * w) return undefined
  const at = (a: number, y: number, b: number): MechanicalPoint => axis === 0 ? point(a, y, b) : point(b, y, a)
  const parts: ComponentBox[] = centres.flatMap((a, index) => channel(`car-upright-${index}`, source,
    at(a, (bottom - lower + top + upper) / 2, transverse), point(w, top - bottom + lower + upper, d), t, rotation))
  // Cross-members and platform beams touch outside the cabin floor/ceiling envelope.
  parts.push(
    box('car-crosshead', source, 'frame', at((centres[0] + centres[1]) / 2, top + upper / 2, transverse), point(span, upper, crossDepth), rotation),
    box('car-lower-member', source, 'frame', at((centres[0] + centres[1]) / 2, bottom - lower / 2, transverse), point(span, lower, crossDepth), rotation),
    ...centres.map((a, i) => box(`car-platform-support-${i}`, source, 'frame',
      at(a, bottom - lower - supportH / 2, frame.cabinBounds.center[other]),
      point(supportW, supportH, frame.cabinBounds.size[other]), rotation)),
  )
  if (parts.some((part) => intersects(componentBoxBounds(part), frame.cabinBounds))) return undefined
  return { source, reference: data.reference, boxes: parts, bounds: boxesBounds(parts) }
}

function createCounterweightFrame(data: CounterweightFrameData, layout: PassengerMechanicalLayout): CounterweightComponentModel | undefined {
  const weight = layout.counterweight
  if (!weight) return undefined
  const { source, slabCount, slabGapMm, stackBottomInsetMm } = data
  // The cap is a rendering resource guard, not a weight-count or engineering limit.
  if (!positiveDimensions(data, ['slabGapMm', 'stackBottomInsetMm']) || !Number.isInteger(slabCount) || slabCount <= 0 || slabCount > 1000 || !nonNegative([slabGapMm, stackBottomInsetMm])) return undefined
  const side = mm(data.sideMemberWidthMm), cross = mm(data.crossMemberHeightMm), wall = mm(data.channelWallThicknessMm)
  const slabSize = point(mm(data.slabWidthMm), mm(data.slabHeightMm), mm(data.slabDepthMm))
  const gap = mm(slabGapMm), inset = mm(stackBottomInsetMm)
  const innerWidth = weight.width - 2 * side, innerHeight = weight.height - 2 * cross
  const innerDepth = weight.depth - wall
  const stackHeight = slabCount * slabSize[1] + (slabCount - 1) * gap
  if (2 * wall >= Math.min(side, weight.depth) || innerWidth <= 0 || innerHeight <= 0 ||
    slabSize[0] > innerWidth || slabSize[2] > innerDepth || inset + stackHeight > innerHeight) return undefined
  const at = (p: MechanicalPoint) => localToWorld(p, weight.center, weight.rotationY)
  const boxes = [-1, 1].flatMap((sign) => [
    ...channel(`counterweight-side-${sign}`, source, at(point(sign * (weight.width / 2 - side / 2), 0, 0)), point(side, innerHeight, weight.depth), wall, weight.rotationY),
    box(`counterweight-crossmember-${sign}`, source, 'frame', at(point(0, sign * (weight.height / 2 - cross / 2), 0)), point(weight.width, cross, weight.depth), weight.rotationY),
  ])
  const stackBottom = -weight.height / 2 + cross
  const slabs = Array.from({ length: slabCount }, (_, i) => box(`counterweight-slab-${i}`, source, 'weight',
    at(point(0, stackBottom + inset + slabSize[1] / 2 + i * (slabSize[1] + gap), wall / 2)), slabSize, weight.rotationY))
  const stackRegion = box('stack-region', source, 'weight', at(point(0, 0, wall / 2)), point(innerWidth, innerHeight, innerDepth), weight.rotationY)
  return { source, reference: data.reference, boxes, slabs, stackBounds: componentBoxBounds(stackRegion), bounds: boxesBounds(boxes) }
}

function createGuideShoes(data: SlidingGuideShoeData, rails: readonly DetailedRail[],
  assembly: StructuralAssemblyModel, mountingOffset: Metres): GuideShoeModel[] | undefined {
  const { source, lowerInsetMm, upperInsetMm, railClearanceMm } = data
  if (!positiveDimensions(data, ['lowerInsetMm', 'upperInsetMm', 'railClearanceMm']) || !nonNegative([lowerInsetMm, upperInsetMm, railClearanceMm])) return undefined
  const height = mm(data.heightMm), body = mm(data.bodyDepthMm), wall = mm(data.wallThicknessMm)
  const liner = mm(data.linerThicknessMm), plate = mm(data.mountingPlateThicknessMm), plateW = mm(data.mountingPlateWidthMm)
  if (!sameCoordinate(body + plate, mountingOffset)) return undefined
  const bottomY = assembly.bounds.min[1] + mm(lowerInsetMm), topY = assembly.bounds.max[1] - mm(upperInsetMm)
  if (bottomY + height / 2 > topY - height / 2 || bottomY - height / 2 < assembly.bounds.min[1] || topY + height / 2 > assembly.bounds.max[1]) return undefined
  if (rails.some((rail) => body <= mm(railClearanceMm) + liner ||
    plateW < rail.profile.headWidth + 2 * (mm(railClearanceMm) + liner + wall))) return undefined
  return rails.flatMap((rail) => {
    const profile = rail.profile, clearance = mm(railClearanceMm)
    const slotHalfWidth = profile.headWidth / 2 + clearance
    const fingerBack = -profile.headThickness - clearance
    return [bottomY, topY].map((y, index) => {
      const id = `${rail.id}-shoe-${index}`
      const origin = point(rail.origin[0], y, rail.origin[2])
      const at = (p: MechanicalPoint) => localToWorld(p, origin, rail.rotationY)
      const boxes = [
        box(`${id}-back`, source, 'shoe', at(point(0, 0, (clearance + liner + body) / 2)), point(2 * (slotHalfWidth + liner + wall), height, body - clearance - liner), rail.rotationY),
        box(`${id}-back-liner`, source, 'liner', at(point(0, 0, clearance + liner / 2)), point(2 * (slotHalfWidth + liner), height, liner), rail.rotationY),
        ...[-1, 1].flatMap((sign) => [
          box(`${id}-side-${sign}`, source, 'shoe', at(point(sign * (slotHalfWidth + liner + wall / 2), 0, (fingerBack + clearance + liner) / 2)), point(wall, height, clearance + liner - fingerBack), rail.rotationY),
          box(`${id}-liner-${sign}`, source, 'liner', at(point(sign * (slotHalfWidth + liner / 2), 0, (fingerBack + clearance) / 2)), point(liner, height, clearance - fingerBack), rail.rotationY),
        ]),
        box(`${id}-mount`, source, 'frame', at(point(0, 0, body + plate / 2)), point(plateW, height, plate), rail.rotationY),
      ]
      return { id, railId: rail.id, source, reference: data.reference, railAxis: origin, rotationY: rail.rotationY,
        mountingCenter: at(point(0, 0, body + plate)), boxes }
    })
  })
}

function createBuffers(data: BufferComponentData, kind: 'car' | 'counterweight',
  positions: readonly MechanicalPoint[]): BufferComponentModel | undefined {
  const { source } = data
  if (!positiveDimensions(data)) return undefined
  const base = point(mm(data.baseWidthMm), mm(data.baseThicknessMm), mm(data.baseDepthMm))
  const bodyHeight = mm(data.bodyHeightMm), plungerHeight = mm(data.plungerHeightMm), contactHeight = mm(data.contactThicknessMm)
  const bodyDiameter = mm(data.bodyDiameterMm), plungerDiameter = mm(data.plungerDiameterMm), contactDiameter = mm(data.contactDiameterMm)
  if (bodyDiameter > Math.min(base[0], base[2]) || plungerDiameter > bodyDiameter) return undefined
  const boxes: ComponentBox[] = [], cylinders: ComponentCylinder[] = []
  positions.forEach((p, index) => {
    const id = `${kind}-buffer-${index}`
    boxes.push(box(`${id}-base`, source, 'buffer', point(p[0], p[1] + base[1] / 2, p[2]), base))
    let y = p[1] + base[1]
    for (const [part, diameter, height, material] of [
      ['body', bodyDiameter, bodyHeight, 'buffer'], ['plunger', plungerDiameter, plungerHeight, 'plunger'],
      ['contact', contactDiameter, contactHeight, 'buffer'],
    ] as const) {
      cylinders.push({ id: `${id}-${part}`, source, material, center: point(p[0], y + height / 2, p[2]), radius: metres(diameter / 2), height })
      y += height
    }
  })
  return { kind, source, reference: data.reference, boxes, cylinders }
}

/** Pure component shape/placement boundary. No Three objects, React, state, or component defaults. */
export function createPassengerMechanicalComponents(
  data: MechanicalComponentData | undefined,
  layout: PassengerMechanicalLayout,
): PassengerMechanicalComponentModel {
  const missingData: string[] = [], issues: ComponentGeometryIssue[] = []
  function supplied<T, R>(key: keyof MechanicalComponentData, value: T | undefined, create: (value: T) => R | undefined): R | undefined {
    if (value === undefined) { missingData.push(`mechanical.components.${key}`); return undefined }
    const result = create(value)
    if (result === undefined) issues.push({ code: 'invalid-component-shape', path: `mechanical.components.${key}` })
    return result
  }
  const profile = supplied('railProfile', data?.railProfile, createTRailProfile)
  const carRailTarget = layout.carFrame?.cabinBounds.center ?? (layout.carRails
    ? point((layout.carRails.rails[0].start[0] + layout.carRails.rails[1].start[0]) / 2, 0,
      (layout.carRails.rails[0].start[2] + layout.carRails.rails[1].start[2]) / 2)
    : undefined)
  const carRails = profile && layout.carRails && carRailTarget ? railPair(layout.carRails, carRailTarget, profile) : undefined
  const counterweightRails = profile && layout.counterweightRails && layout.counterweight ? railPair(layout.counterweightRails, layout.counterweight.center, profile) : undefined
  const carSling = layout.carFrame ? supplied('carSling', data?.carSling, (d) => createCarSling(d, layout)) : undefined
  const counterweightFrame = layout.counterweight ? supplied('counterweightFrame', data?.counterweightFrame, (d) => createCounterweightFrame(d, layout)) : undefined
  const carGuideShoes = carRails && carSling && data?.carSling ? supplied('carGuideShoe', data.carGuideShoe, (d) =>
    createGuideShoes(d, carRails, carSling, metres(mm(data.carSling!.railToUprightCentreMm) - mm(data.carSling!.uprightWidthMm) / 2))) ?? [] : []
  const counterweightGuideShoes = counterweightRails && counterweightFrame && layout.counterweight ? supplied('counterweightGuideShoe', data?.counterweightGuideShoe, (d) => {
    const weight = layout.counterweight!
    const axis = weight.arrangement === 'rear' ? 0 : 2
    const offsets = counterweightRails.map((r) => Math.abs(r.origin[axis] - weight.center[axis]) - weight.width / 2)
    if (!sameCoordinate(offsets[0], offsets[1])) return undefined
    return createGuideShoes(d, counterweightRails, counterweightFrame, metres(offsets[0]))
  }) ?? [] : []
  const carBuffers = layout.carBuffers ? supplied('carBuffer', data?.carBuffer, (d) => createBuffers(d, 'car', layout.carBuffers!.basePositions)) : undefined
  const counterweightBuffers = layout.counterweightBuffers ? supplied('counterweightBuffer', data?.counterweightBuffer, (d) => createBuffers(d, 'counterweight', layout.counterweightBuffers!.basePositions)) : undefined

  const parts = [...(carSling?.boxes ?? []), ...(counterweightFrame?.boxes ?? []), ...(counterweightFrame?.slabs ?? []),
    ...carGuideShoes.flatMap((s) => s.boxes), ...counterweightGuideShoes.flatMap((s) => s.boxes),
    ...(carBuffers?.boxes ?? []), ...(counterweightBuffers?.boxes ?? [])]
  const extentPoints = parts.flatMap((p) => { const b = componentBoxBounds(p); return [b.min, b.max] })
  for (const rail of [...(carRails ?? []), ...(counterweightRails ?? [])]) {
    extentPoints.push(...rail.profile.points.flatMap(([u, v]) => [0, rail.length].map((y) => localToWorld(point(u, y, v), rail.origin, rail.rotationY))))
  }
  for (const cylinder of [...(carBuffers?.cylinders ?? []), ...(counterweightBuffers?.cylinders ?? [])]) {
    extentPoints.push(point(cylinder.center[0] - cylinder.radius, cylinder.center[1] - cylinder.height / 2, cylinder.center[2] - cylinder.radius),
      point(cylinder.center[0] + cylinder.radius, cylinder.center[1] + cylinder.height / 2, cylinder.center[2] + cylinder.radius))
  }
  return { carRails, counterweightRails, carSling, counterweightFrame, carGuideShoes, counterweightGuideShoes,
    carBuffers, counterweightBuffers, missingData, issues,
    bounds: createMechanicalBounds([layout.bounds.min, layout.bounds.max, ...extentPoints]) }
}
