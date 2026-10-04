import type { CounterweightPosition } from '../../../../elevator'
import {
  metres, millimetresToMetres,
  type Metres, type Millimetres, type TechnicalValidationResult, type ValidationIssue,
} from '../../../../engineering'
import type { PassengerGeometryPlanningInput } from '../../lift-geometry-planning-input'
import type { PassengerInstallationModel } from '../passenger-installation-model'
import { resolveVerticalRecord } from '../passenger-vertical-model'
import type {
  MechanicalPlanningPointMm, MechanicalPlanningPlanPositionMm,
  RailOrientation, SuspensionArrangement,
} from './passenger-mechanical-planning-input'

export type MechanicalPoint = readonly [Metres, Metres, Metres]
export type MechanicalLayoutSource = 'planning' | 'schematic'
export interface MechanicalBounds {
  readonly min: MechanicalPoint
  readonly max: MechanicalPoint
  readonly center: MechanicalPoint
  readonly size: MechanicalPoint
  readonly width: Metres
  readonly depth: Metres
  readonly height: Metres
  readonly centerY: Metres
}
export interface PassengerRailLineLayout {
  readonly id: string
  readonly start: MechanicalPoint
  readonly end: MechanicalPoint
}
export interface PassengerRailSystemLayout {
  readonly kind: 'car' | 'counterweight'
  readonly source: 'planning'
  readonly rails: readonly [PassengerRailLineLayout, PassengerRailLineLayout]
}
export interface PassengerCarFrameLayout {
  readonly envelopeSource: 'planning'
  readonly constructionSource: 'schematic'
  readonly orientation: RailOrientation
  readonly uprights: readonly [PassengerRailLineLayout, PassengerRailLineLayout]
  readonly crosshead: PassengerRailLineLayout
  readonly lowerSling: PassengerRailLineLayout
  readonly platformSupports: readonly [PassengerRailLineLayout, PassengerRailLineLayout]
  readonly bounds: MechanicalBounds
  readonly cabinBounds: MechanicalBounds
}
export interface PassengerCounterweightLayout {
  readonly dimensionsSource: 'planning'
  readonly placementSource: 'planning'
  readonly arrangement: CounterweightPosition
  readonly width: Metres
  readonly height: Metres
  readonly depth: Metres
  readonly center: MechanicalPoint
  readonly rotationY: number
  readonly bounds: MechanicalBounds
}
export interface PassengerBufferLayout {
  readonly kind: 'car' | 'counterweight'
  readonly source: 'planning'
  readonly basePositions: readonly MechanicalPoint[]
}
export interface PassengerMachineLayout {
  readonly source: 'planning'
  readonly center: MechanicalPoint
  readonly size: MechanicalPoint
  readonly bounds: MechanicalBounds
}
export interface PassengerSheaveLayout {
  readonly source: 'planning'
  readonly center: MechanicalPoint
  readonly diameter: Metres
  readonly bounds: MechanicalBounds
}
export interface PassengerSuspensionLayout {
  readonly source: 'planning'
  readonly arrangement: SuspensionArrangement
  readonly path: readonly MechanicalPoint[]
}
export interface PassengerMechanicalZoneLayout {
  readonly kind: 'bottom' | 'top'
  readonly source: 'planning'
  readonly width: Metres
  readonly depth: Metres
  readonly bottomY: Metres
  readonly topY: Metres
  readonly centerY: Metres
  readonly height: Metres
}
export type MechanicalPlanningIssueCode =
  | 'non-finite-coordinate' | 'non-positive-dimension' | 'collapsed-rail-pair'
  | 'outside-shaft' | 'frame-intersects-cabin' | 'invalid-rail-axis'
  | 'counterweight-intersects-cabin' | 'arrangement-mismatch'
  | 'rail-pair-misses-assembly' | 'buffer-outside-pit' | 'buffer-misses-assembly'
  | 'invalid-zone-offset'
export interface PassengerMechanicalLayout {
  readonly carFrame?: PassengerCarFrameLayout
  readonly carRails?: PassengerRailSystemLayout
  readonly counterweight?: PassengerCounterweightLayout
  readonly counterweightRails?: PassengerRailSystemLayout
  readonly carBuffers?: PassengerBufferLayout
  readonly counterweightBuffers?: PassengerBufferLayout
  readonly machine?: PassengerMachineLayout
  readonly tractionSheave?: PassengerSheaveLayout
  readonly suspension?: PassengerSuspensionLayout
  readonly zones: readonly PassengerMechanicalZoneLayout[]
  readonly bounds: MechanicalBounds
  readonly validation: TechnicalValidationResult<MechanicalPlanningIssueCode>
  readonly missingFields: readonly string[]
}

export function createMechanicalBounds(points: readonly MechanicalPoint[]): MechanicalBounds {
  if (points.length === 0) return createMechanicalBounds([[metres(0), metres(0), metres(0)]])
  const min = [0, 1, 2].map((axis) => metres(Math.min(...points.map((p) => p[axis])))) as unknown as MechanicalPoint
  const max = [0, 1, 2].map((axis) => metres(Math.max(...points.map((p) => p[axis])))) as unknown as MechanicalPoint
  const size = max.map((v, i) => metres(v - min[i])) as unknown as MechanicalPoint
  const center = min.map((v, i) => metres(v + size[i] / 2)) as unknown as MechanicalPoint
  return { min, max, size, center, width: size[0], height: size[1], depth: size[2], centerY: center[1] }
}
function boxBounds(center: MechanicalPoint, size: MechanicalPoint): MechanicalBounds {
  return createMechanicalBounds([
    center.map((v, i) => metres(v - size[i] / 2)) as unknown as MechanicalPoint,
    center.map((v, i) => metres(v + size[i] / 2)) as unknown as MechanicalPoint,
  ])
}
function toPoint(p: MechanicalPlanningPointMm): MechanicalPoint {
  return [millimetresToMetres(p.xMm), millimetresToMetres(p.yMm), millimetresToMetres(p.zMm)]
}
function isCompletePoint(p: Partial<MechanicalPlanningPointMm>): p is MechanicalPlanningPointMm {
  return p.xMm !== undefined && p.yMm !== undefined && p.zMm !== undefined
}
function toPlanPoint(p: MechanicalPlanningPlanPositionMm, y: Metres): MechanicalPoint {
  return [millimetresToMetres(p.xMm), y, millimetresToMetres(p.zMm)]
}
function overlaps(a: MechanicalBounds, b: MechanicalBounds): boolean {
  return [0, 1, 2].every((axis) => a.min[axis] < b.max[axis] && a.max[axis] > b.min[axis])
}
function line(id: string, start: MechanicalPoint, end: MechanicalPoint): PassengerRailLineLayout {
  return { id, start, end }
}

export function createPassengerMechanicalLayout(
  input: PassengerGeometryPlanningInput,
  installation: PassengerInstallationModel,
): PassengerMechanicalLayout {
  const cabin = installation.cabin
  const shaft = installation.shaft
  const issues: ValidationIssue<MechanicalPlanningIssueCode>[] = []
  const missingFields: string[] = []
  const resolve = <T,>(record: T | undefined, path: string) => resolveVerticalRecord(record, installation.vertical, missingFields, path)
  const planning = { ...input.mechanical,
    machine: resolve(input.mechanical.machine, 'mechanical.machine'),
    tractionSheave: resolve(input.mechanical.tractionSheave, 'mechanical.tractionSheave'),
    suspension: resolve(input.mechanical.suspension, 'mechanical.suspension'),
    carBufferPositionsMm: input.mechanical.carBufferPositionsMm?.flatMap((p, i) => { const value = resolve(p, `mechanical.carBufferPositionsMm.${i}`); return value ? [value] : [] }),
    counterweightBufferPositionsMm: input.mechanical.counterweightBufferPositionsMm?.flatMap((p, i) => { const value = resolve(p, `mechanical.counterweightBufferPositionsMm.${i}`); return value ? [value] : [] }),
  }
  const issue = (code: MechanicalPlanningIssueCode, path: string, context?: Record<string, unknown>) => {
    if (!issues.some((entry) => entry.code === code && entry.path?.join('.') === path)) {
      issues.push({ code, severity: 'error', path: path.split('.'), messageKey: `mechanical.${code}`, context })
    }
    return false
  }
  const finite = (values: readonly number[], path: string) =>
    values.every(Number.isFinite) || issue('non-finite-coordinate', path)
  const positive = (values: readonly number[], path: string) =>
    finite(values, path) && (values.every((v) => v > 0) || issue('non-positive-dimension', path))
  const pointValid = (p: MechanicalPlanningPointMm, path: string) => finite([p.xMm, p.yMm, p.zMm], path)
  const inspectCoordinates = (value: unknown, path: string) => {
    if (typeof value === 'number') finite([value], path)
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) inspectCoordinates(child, `${path}.${key}`)
    }
  }
  inspectCoordinates(planning, 'mechanical')
  const suppliedDimensions = [input.counterweight.widthMm, input.counterweight.heightMm, input.counterweight.depthMm].filter((v): v is Millimetres => v !== undefined)
  if (suppliedDimensions.length) positive(suppliedDimensions, 'counterweight')
  if (planning.carRailSpacingMm !== undefined) positive([planning.carRailSpacingMm], 'mechanical.carRailSpacingMm')
  if (planning.counterweightRailSpacingMm !== undefined) positive([planning.counterweightRailSpacingMm], 'mechanical.counterweightRailSpacingMm')
  if (planning.machine?.envelopeMm) positive(Object.values(planning.machine.envelopeMm), 'mechanical.machine.envelopeMm')
  if (planning.tractionSheave?.diameterMm !== undefined) positive([planning.tractionSheave.diameterMm], 'mechanical.tractionSheave.diameterMm')
  if (planning.machine && (!planning.machine.positionMm || !planning.machine.envelopeMm)) missingFields.push('mechanical.machine')
  if (planning.tractionSheave && (!planning.tractionSheave.positionMm || planning.tractionSheave.diameterMm === undefined)) missingFields.push('mechanical.tractionSheave')
  if (planning.suspension && (!planning.suspension.arrangement || !planning.suspension.pathPointsMm || planning.suspension.pathPointsMm.length < 2)) missingFields.push('mechanical.suspension')
  const highestLevel = installation.vertical.highestLandingY
  // Only explicit pit/headroom data establish vertical envelope constraints.
  const knownBottom = installation.vertical.pitBottomY
  const knownTop = installation.vertical.shaftTopY
  const lowestLevel = installation.vertical.lowestLandingY ?? metres(0)
  const topInset = planning.zones?.topInsetMm
  if (topInset !== undefined && (!Number.isFinite(topInset) || topInset < 0 ||
    (knownTop !== undefined && input.shaft.headroomMm !== undefined && topInset > input.shaft.headroomMm))) issue('invalid-zone-offset', 'mechanical.zones.topInsetMm')
  const insideShaft = (bounds: MechanicalBounds, path: string) => {
    if (!shaft) return true
    const inside = bounds.min[0] >= -shaft.width / 2 && bounds.max[0] <= shaft.width / 2 &&
      bounds.min[2] >= -shaft.depth / 2 && bounds.max[2] <= shaft.depth / 2 &&
      (knownBottom === undefined || bounds.min[1] >= knownBottom) &&
      (knownTop === undefined || bounds.max[1] <= knownTop)
    return inside || issue('outside-shaft', path, { min: bounds.min, max: bounds.max })
  }
  const cabinBounds = cabin ? boxBounds([metres(0), cabin.centerY, metres(0)], [cabin.width, cabin.height, cabin.depth]) : undefined
  if (cabinBounds) insideShaft(cabinBounds, 'cabin')
  const travelBottom = shaft?.verticalExtent?.bottomY ?? cabin?.bottomY
  const travelTop = shaft?.verticalExtent?.topY ?? (cabin ? metres(cabin.bottomY + cabin.height) : undefined)
  const makeRails = (kind: 'car' | 'counterweight', positions: readonly MechanicalPoint[]) => {
    if (travelBottom === undefined || travelTop === undefined) return undefined
    const [a, b] = positions
    if (!a || !b || !finite([...a, ...b], `${kind}Rails`)) return undefined
    if (a[0] === b[0] && a[2] === b[2]) {
      issue('collapsed-rail-pair', `${kind}Rails`)
      return undefined
    }
    const rails = [
      line(`${kind}-rail-1`, [a[0], travelBottom, a[2]], [a[0], travelTop, a[2]]),
      line(`${kind}-rail-2`, [b[0], travelBottom, b[2]], [b[0], travelTop, b[2]]),
    ] as const
    if (!insideShaft(createMechanicalBounds(rails.flatMap((r) => [r.start, r.end])), `${kind}Rails`)) return undefined
    return { kind, source: 'planning' as const, rails }
  }
  let carRails: PassengerRailSystemLayout | undefined
  if (planning.carRailPositionsMm) {
    carRails = makeRails('car', planning.carRailPositionsMm.map((p) => toPlanPoint(p, metres(0))))
  } else if (planning.carRailSpacingMm !== undefined && planning.carRailOrientation) {
    if (positive([planning.carRailSpacingMm], 'mechanical.carRailSpacingMm')) {
      const spacing = millimetresToMetres(planning.carRailSpacingMm)
      // A symmetric pair is centred on the documented cabin travel axis unless an explicit axis is supplied.
      const axis = planning.carRailAxisMm ? toPlanPoint(planning.carRailAxisMm, metres(0)) : [metres(0), metres(0), metres(0)] as const
      const dimension = planning.carRailOrientation === 'x' ? 0 : 2
      carRails = makeRails('car', [-1, 1].map((direction) => axis.map((v, i) => metres(v + (i === dimension ? direction * spacing / 2 : 0))) as unknown as MechanicalPoint))
    }
  } else {
    missingFields.push('mechanical.carRailSpacingMm', 'mechanical.carRailOrientation')
  }
  let carFrame: PassengerCarFrameLayout | undefined
  if (carRails && cabin && cabinBounds) {
    const positions = carRails.rails.map((r) => r.start)
    const orientation = positions[0][2] === positions[1][2] ? 'x' : positions[0][0] === positions[1][0] ? 'z' : undefined
    if (!orientation) {
      issue('invalid-rail-axis', 'carRails')
      carRails = undefined
    }
    else {
      const axis = orientation === 'x' ? 0 : 2
      const otherAxis = orientation === 'x' ? 2 : 0
      const sorted = [...positions].sort((a, b) => a[axis] - b[axis])
      const [a, b] = sorted
      if (a[axis] > cabinBounds.min[axis] || b[axis] < cabinBounds.max[axis] ||
          a[otherAxis] < cabinBounds.min[otherAxis] || a[otherAxis] > cabinBounds.max[otherAxis]) {
        issue('frame-intersects-cabin', 'carFrame')
        carRails = undefined
      } else {
        const bottomY = cabin.bottomY
        const topY = metres(bottomY + cabin.height)
        const atY = (p: MechanicalPoint, y: Metres): MechanicalPoint => [p[0], y, p[2]]
        const uprights = [line('frame-upright-1', atY(a, bottomY), atY(a, topY)), line('frame-upright-2', atY(b, bottomY), atY(b, topY))] as const
        const support = (p: MechanicalPoint, id: string) => {
          const start = [...atY(p, bottomY)]
          const end = [...start]
          start[otherAxis] = cabinBounds.min[otherAxis]
          end[otherAxis] = cabinBounds.max[otherAxis]
          return line(id, start as unknown as MechanicalPoint, end as unknown as MechanicalPoint)
        }
        carFrame = {
          envelopeSource: 'planning', constructionSource: 'schematic', orientation,
          uprights, crosshead: line('frame-crosshead', atY(a, topY), atY(b, topY)),
          lowerSling: line('frame-lower-sling', atY(a, bottomY), atY(b, bottomY)),
          platformSupports: [support(a, 'platform-support-1'), support(b, 'platform-support-2')],
          bounds: createMechanicalBounds([cabinBounds.min, cabinBounds.max, ...uprights.flatMap((r) => [r.start, r.end])]), cabinBounds,
        }
      }
    }
  }

  let counterweight: PassengerCounterweightLayout | undefined
  const { widthMm, heightMm, depthMm } = input.counterweight
  const arrangement = planning.counterweightArrangement ?? input.counterweight.position
  const offset = planning.counterweightOffsetMm
  if (cabin && widthMm !== undefined && heightMm !== undefined && depthMm !== undefined && arrangement && offset && isCompletePoint(offset)) {
    if (positive([widthMm, heightMm, depthMm], 'counterweight') && pointValid(offset, 'mechanical.counterweightOffsetMm')) {
      const width = millimetresToMetres(widthMm)
      const height = millimetresToMetres(heightMm)
      const depth = millimetresToMetres(depthMm)
      const displacement = toPoint(offset)
      const center: MechanicalPoint = [displacement[0], metres(cabin.centerY + displacement[1]), displacement[2]]
      const size: MechanicalPoint = arrangement === 'rear' ? [width, height, depth] : [depth, height, width]
      const bounds = boxBounds(center, size)
      const matchesSide = arrangement === 'rear' ? bounds.max[2] <= -cabin.depth / 2
        : arrangement === 'left' ? bounds.max[0] <= -cabin.width / 2 : bounds.min[0] >= cabin.width / 2
      const fits = insideShaft(bounds, 'counterweight')
      if (cabinBounds && overlaps(bounds, cabinBounds)) issue('counterweight-intersects-cabin', 'counterweight')
      else if (!matchesSide) issue('arrangement-mismatch', 'mechanical.counterweightArrangement')
      else if (fits) counterweight = { dimensionsSource: 'planning', placementSource: 'planning', arrangement, width, height, depth, center, rotationY: arrangement === 'rear' ? 0 : Math.PI / 2, bounds }
    }
  } else {
    if (widthMm === undefined) missingFields.push('counterweight.widthMm')
    if (heightMm === undefined) missingFields.push('counterweight.heightMm')
    if (depthMm === undefined) missingFields.push('counterweight.depthMm')
    if (!arrangement) missingFields.push('mechanical.counterweightArrangement')
    if (!offset || !isCompletePoint(offset)) missingFields.push('mechanical.counterweightOffsetMm')
  }
  let counterweightRails: PassengerRailSystemLayout | undefined
  if (counterweight) {
    const axis = counterweight.arrangement === 'rear' ? 0 : 2
    const otherAxis = axis === 0 ? 2 : 0
    if (planning.counterweightRailPositionsMm) {
      counterweightRails = makeRails('counterweight', planning.counterweightRailPositionsMm.map((p) => toPlanPoint(p, metres(0))))
    } else if (planning.counterweightRailSpacingMm !== undefined) {
      if (positive([planning.counterweightRailSpacingMm], 'mechanical.counterweightRailSpacingMm')) {
        const spacing = millimetresToMetres(planning.counterweightRailSpacingMm)
        counterweightRails = makeRails('counterweight', [-1, 1].map((direction) => counterweight.center.map((v, i) => metres(v + (i === axis ? direction * spacing / 2 : 0))) as unknown as MechanicalPoint))
      }
    } else missingFields.push('mechanical.counterweightRailSpacingMm')
    if (counterweightRails) {
      const [a, b] = [...counterweightRails.rails].sort((a, b) => a.start[axis] - b.start[axis])
      if (a.start[axis] > counterweight.bounds.min[axis] || b.start[axis] < counterweight.bounds.max[axis] ||
          a.start[otherAxis] !== counterweight.center[otherAxis] || b.start[otherAxis] !== counterweight.center[otherAxis]) {
        issue('rail-pair-misses-assembly', 'counterweightRails')
        counterweightRails = undefined
      }
    }
  }

  const makeBuffers = (kind: 'car' | 'counterweight', positions: readonly MechanicalPlanningPointMm[] | undefined, assembly: MechanicalBounds | undefined): PassengerBufferLayout | undefined => {
    if (!positions || positions.length === 0 || !installation.pit || !assembly) return undefined
    const basePositions: MechanicalPoint[] = []
    const pitBottom = installation.pit.centerY - installation.pit.height / 2
    for (const [index, p] of positions.entries()) {
      const path = `mechanical.${kind === 'car' ? 'car' : 'counterweight'}BufferPositionsMm.${index}`
      if (!pointValid(p, path)) continue
      const position = toPoint(p)
      if (!insideShaft(createMechanicalBounds([position]), path)) continue
      if (position[1] < pitBottom || position[1] >= lowestLevel) { issue('buffer-outside-pit', path); continue }
      if (position[0] < assembly.min[0] || position[0] > assembly.max[0] || position[2] < assembly.min[2] || position[2] > assembly.max[2]) {
        issue('buffer-misses-assembly', path); continue
      }
      basePositions.push(position)
    }
    return basePositions.length ? { kind, source: 'planning', basePositions } : undefined
  }
  const carBuffers = makeBuffers('car', planning.carBufferPositionsMm, carFrame?.bounds ?? cabinBounds)
  const counterweightBuffers = makeBuffers('counterweight', planning.counterweightBufferPositionsMm, counterweight?.bounds)
  let machine: PassengerMachineLayout | undefined
  if (planning.machine?.positionMm && planning.machine.envelopeMm) {
    const p = planning.machine.positionMm
    const e = planning.machine.envelopeMm
    if (pointValid(p, 'mechanical.machine.positionMm') && positive([e.widthMm, e.heightMm, e.depthMm], 'mechanical.machine.envelopeMm')) {
      const center = toPoint(p)
      const size: MechanicalPoint = [millimetresToMetres(e.widthMm), millimetresToMetres(e.heightMm), millimetresToMetres(e.depthMm)]
      const bounds = boxBounds(center, size)
      if (insideShaft(bounds, 'machine')) machine = { source: 'planning', center, size, bounds }
    }
  }
  let tractionSheave: PassengerSheaveLayout | undefined
  if (planning.tractionSheave?.positionMm && planning.tractionSheave.diameterMm !== undefined) {
    const p = planning.tractionSheave.positionMm
    const d = planning.tractionSheave.diameterMm
    if (pointValid(p, 'mechanical.tractionSheave.positionMm') && positive([d], 'mechanical.tractionSheave.diameterMm')) {
      const center = toPoint(p)
      const diameter = millimetresToMetres(d)
      const bounds = boxBounds(center, [diameter, diameter, metres(0)])
      if (insideShaft(bounds, 'tractionSheave')) tractionSheave = { source: 'planning', center, diameter, bounds }
    }
  }
  let suspension: PassengerSuspensionLayout | undefined
  if (planning.suspension?.arrangement && planning.suspension.pathPointsMm && planning.suspension.pathPointsMm.length >= 2) {
    const points = planning.suspension.pathPointsMm
    const valid = points.map((p, i) => pointValid(p, `mechanical.suspension.pathPointsMm.${i}`)).every(Boolean)
    if (valid) {
      const path = points.map(toPoint)
      if (insideShaft(createMechanicalBounds(path), 'suspension')) suspension = { source: 'planning', arrangement: planning.suspension.arrangement, path }
    }
  }
  const zones: PassengerMechanicalZoneLayout[] = []
  const makeZone = (kind: 'bottom' | 'top', bottom: number, top: number, offsetMm: Millimetres | undefined) => {
    if (!shaft) return
    if (offsetMm !== undefined && (!Number.isFinite(offsetMm) || offsetMm < 0)) { issue('invalid-zone-offset', `mechanical.zones.${kind}OffsetMm`); return }
    const offset = offsetMm === undefined ? 0 : millimetresToMetres(offsetMm)
    const bottomY = metres(bottom + offset)
    const topY = metres(top)
    if (bottomY >= topY) { if (offsetMm !== undefined) issue('invalid-zone-offset', `mechanical.zones.${kind}OffsetMm`); return }
    zones.push({ kind, source: 'planning', width: shaft.width, depth: shaft.depth, bottomY, topY, height: metres(topY - bottomY), centerY: metres((bottomY + topY) / 2) })
  }
  if (installation.pit && knownBottom !== undefined) makeZone('bottom', knownBottom, lowestLevel, planning.zones?.bottomOffsetMm)
  if (highestLevel !== undefined && knownTop !== undefined) makeZone('top', highestLevel, knownTop, planning.zones?.topOffsetMm)

  const boundsPoints: MechanicalPoint[] = [
    [metres(-installation.bounds.width / 2), metres(installation.bounds.centerY - installation.bounds.height / 2), metres(-installation.bounds.depth / 2)],
    [metres(installation.bounds.width / 2), metres(installation.bounds.centerY + installation.bounds.height / 2), metres(installation.bounds.depth / 2)],
    ...[carFrame?.bounds, counterweight?.bounds, machine?.bounds, tractionSheave?.bounds].flatMap((b) => b ? [b.min, b.max] : []),
    ...[carRails, counterweightRails].flatMap((r) => r ? r.rails.flatMap((rail) => [rail.start, rail.end]) : []),
    ...(carBuffers?.basePositions ?? []), ...(counterweightBuffers?.basePositions ?? []), ...(suspension?.path ?? []),
  ]
  return { carFrame, carRails, counterweight, counterweightRails, carBuffers, counterweightBuffers, machine, tractionSheave, suspension, zones,
    bounds: createMechanicalBounds(boundsPoints), missingFields,
    validation: { state: issues.length ? 'invalid' : missingFields.length ? 'incomplete' : 'valid', issues },
  }
}

export function getPassengerMechanicalDebugPositions(layout: PassengerMechanicalLayout) {
  const carRails = layout.carRails ? [...layout.carRails.rails].sort((a, b) => a.start[0] - b.start[0] || a.start[2] - b.start[2]) : undefined
  return {
    cabinRailLeft: carRails?.[0], cabinRailRight: carRails?.[1],
    counterweightRailA: layout.counterweightRails?.rails[0], counterweightRailB: layout.counterweightRails?.rails[1],
    frameBounds: layout.carFrame?.bounds, counterweightBounds: layout.counterweight?.bounds,
    carBufferPositions: layout.carBuffers?.basePositions, counterweightBufferPositions: layout.counterweightBuffers?.basePositions,
    machinePosition: layout.machine?.center, sheavePosition: layout.tractionSheave?.center,
    bounds: layout.bounds, validation: layout.validation,
  }
}
