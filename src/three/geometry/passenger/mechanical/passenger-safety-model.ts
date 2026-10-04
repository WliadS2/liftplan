import type { ComponentDataSource } from '../../../../elevator/configuration/mechanical-component-data'
import type { PassengerSafetyData, SafetyGearData, SafetyWheelAssemblyData } from '../../../../elevator/configuration/passenger-safety-data'
import { metres, millimetresToMetres, type Metres, type TechnicalValidationResult, type ValidationIssue } from '../../../../engineering'
import type { PassengerInstallationModel } from '../passenger-installation-model'
import { componentBoxBounds, type ComponentBox, type DetailedRail, type PassengerMechanicalComponentModel } from './mechanical-component-model'
import { createMechanicalBounds, type MechanicalBounds, type MechanicalPoint, type PassengerMechanicalLayout } from './passenger-mechanical-layout'
import { createSheaveModel, sheaveContactPoint, sheaveContactTangent, type SheaveModel } from './sheave-model'
import type { CableSegment } from './cable-segment'
import {
  drivePoint as p, toDrivePoint, toDriveSize, transformDrivePoint, positiveDriveDimensions,
  nearDriveValue, driveDistance, driveBoundsOverlap, ropeSegmentIntersects, GEOMETRY_EPSILON,
} from './drive-geometry'
import type { TractionMachineModel } from './traction-drive-model'

export interface SafetyCylinder {
  readonly id: string; readonly source: ComponentDataSource
  readonly center: MechanicalPoint; readonly radius: Metres; readonly length: Metres
  readonly rotation: readonly [number, number, number]; readonly bounds: MechanicalBounds
}
export interface SafetyWheelAssemblyModel {
  readonly kind: 'governor' | 'tension'; readonly source: ComponentDataSource; readonly reference?: string
  readonly wheel: SheaveModel; readonly boxes: readonly ComponentBox[]; readonly shaft: SafetyCylinder
  readonly bounds: MechanicalBounds
}
export interface SafetyGearModel {
  readonly id: string; readonly side: 'left' | 'right'; readonly kind: 'generic'; readonly source: ComponentDataSource; readonly reference?: string
  readonly railId: string; readonly railAxis: MechanicalPoint; readonly rotationY: number
  readonly mountPoint: MechanicalPoint; readonly linkagePoint: MechanicalPoint
  readonly boxes: readonly ComponentBox[]; readonly bounds: MechanicalBounds
}
export interface GovernorLinkageModel {
  readonly id: string; readonly source: ComponentDataSource; readonly reference?: string
  readonly ropeConnection: MechanicalPoint; readonly clamp: ComponentBox
  readonly paths: readonly { readonly gearId: string; readonly points: readonly MechanicalPoint[] }[]
  readonly rods: readonly SafetyCylinder[]; readonly bounds: MechanicalBounds
}
export interface GovernorRopeModel {
  readonly source: ComponentDataSource; readonly reference?: string; readonly diameter: Metres
  readonly closed: true; readonly contacts: readonly ('governor' | 'tension')[]; readonly linkageId: string
  readonly segments: readonly CableSegment[]; readonly points: readonly MechanicalPoint[]; readonly bounds: MechanicalBounds
}
export interface MachineBrakeModel {
  readonly source: ComponentDataSource; readonly reference?: string; readonly kind: 'generic'
  readonly machineMountPartId: string; readonly wheel: SheaveModel
  readonly boxes: readonly ComponentBox[]; readonly bounds: MechanicalBounds
}
export type SafetyIssueCode = 'invalid-safety-shape' | 'outside-safety-envelope' | 'unmounted-safety-wheel'
  | 'missing-safety-rail' | 'duplicate-safety-gear' | 'unsupported-safety-gear' | 'detached-safety-gear'
  | 'invalid-safety-linkage' | 'invalid-governor-rope' | 'zero-length-safety-route' | 'non-tangent-safety-route'
  | 'safety-rope-intersects-solid' | 'invalid-machine-brake'
export interface PassengerSafetyModel {
  readonly governor?: SafetyWheelAssemblyModel; readonly tension?: SafetyWheelAssemblyModel
  readonly gears: readonly SafetyGearModel[]; readonly linkage?: GovernorLinkageModel
  readonly governorRope?: GovernorRopeModel; readonly machineBrake?: MachineBrakeModel
  readonly bounds?: MechanicalBounds; readonly missingData: readonly string[]
  readonly validation: TechnicalValidationResult<SafetyIssueCode>
}

const mm = millimetresToMetres
const boundsOf = (boxes: readonly ComponentBox[], extras: readonly MechanicalBounds[] = []) =>
  createMechanicalBounds([...boxes.map(componentBoxBounds), ...extras].flatMap((b) => [b.min, b.max]))
const box = (id: string, source: ComponentDataSource, center: MechanicalPoint, size: MechanicalPoint, rotationY = 0,
  material: ComponentBox['material'] = 'safetyGear'): ComponentBox => ({ id, source, material, center, size, rotationY })
const touches = (a: MechanicalBounds, b: MechanicalBounds) => [0, 1, 2].every((i) => a.min[i] <= b.max[i] + GEOMETRY_EPSILON && a.max[i] >= b.min[i] - GEOMETRY_EPSILON)
const inBounds = (point: MechanicalPoint, bounds: MechanicalBounds) => point.every((v, i) => v >= bounds.min[i] - GEOMETRY_EPSILON && v <= bounds.max[i] + GEOMETRY_EPSILON)
const validBox = (b: SafetyWheelAssemblyData['base']) => Object.values(b.centerMm).every(Number.isFinite) && positiveDriveDimensions(Object.values(b.sizeMm))
const delta = (a: MechanicalPoint, b: MechanicalPoint) => p(b[0] - a[0], b[1] - a[1], b[2] - a[2])
const aligned = (a: MechanicalPoint, b: MechanicalPoint) => {
  const length = Math.hypot(...a) * Math.hypot(...b)
  return length > 0 && a.reduce((sum, v, i) => sum + v * b[i], 0) / length > 1 - GEOMETRY_EPSILON
}

function cylinder(id: string, source: ComponentDataSource, start: MechanicalPoint, end: MechanicalPoint, diameter: Metres): SafetyCylinder {
  const d = delta(start, end), length = driveDistance(start, end), radius = metres(diameter / 2)
  return { id, source, center: p((start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2), radius, length: metres(length),
    rotation: [Math.atan2(d[2], d[1]), 0, -Math.asin(Math.max(-1, Math.min(1, d[0] / length)))],
    bounds: createMechanicalBounds([p(Math.min(start[0], end[0]) - radius, Math.min(start[1], end[1]) - radius, Math.min(start[2], end[2]) - radius),
      p(Math.max(start[0], end[0]) + radius, Math.max(start[1], end[1]) + radius, Math.max(start[2], end[2]) + radius)]) }
}

function gearShape(data: SafetyGearData, rail: DetailedRail): SafetyGearModel | undefined {
  if (data.kind !== 'generic' || !positiveDriveDimensions([data.heightMm, data.bodyDepthMm, data.wallThicknessMm,
    data.slotWidthMm, data.slotDepthMm, data.railTipGapMm, data.mountingPlateThicknessMm, data.mountingPlateWidthMm]) ||
    !Number.isFinite(data.elevationMm) || !Object.values(data.linkagePointLocalMm).every(Number.isFinite)) return undefined
  const h = mm(data.heightMm), depth = mm(data.bodyDepthMm), wall = mm(data.wallThicknessMm)
  const gap = mm(data.railTipGapMm), slot = mm(data.slotWidthMm), slotDepth = mm(data.slotDepthMm), plate = mm(data.mountingPlateThicknessMm)
  if (slot <= rail.profile.headWidth || slotDepth <= rail.profile.headThickness || gap >= depth || mm(data.mountingPlateWidthMm) < slot + wall * 2) return undefined
  const origin = p(rail.origin[0], mm(data.elevationMm), rail.origin[2]), rotation = rail.rotationY
  const at = (local: MechanicalPoint) => transformDrivePoint(local, origin, rotation)
  const boxes = [
    box(`${data.id}-body`, data.source, at(p(0, 0, (gap + depth) / 2)), p(slot + 2 * wall, h, depth - gap), rotation),
    ...[-1, 1].map((sign) => box(`${data.id}-engagement-${sign}`, data.source,
      at(p(sign * (slot / 2 + wall / 2), 0, (gap - slotDepth) / 2)), p(wall, h, gap + slotDepth), rotation)),
    box(`${data.id}-mount`, data.source, at(p(0, 0, depth + plate / 2)), p(mm(data.mountingPlateWidthMm), h, plate), rotation),
  ]
  const linkagePoint = at(toDrivePoint(data.linkagePointLocalMm))
  if (!boxes.some((b) => inBounds(linkagePoint, componentBoxBounds(b)))) return undefined
  return { id: data.id, side: data.side, kind: 'generic', source: data.source, reference: data.reference,
    railId: rail.id, railAxis: origin, rotationY: rotation, boxes, mountPoint: at(p(0, 0, depth + plate)), linkagePoint, bounds: boundsOf(boxes) }
}

interface RoutePiece {
  start: MechanicalPoint; end: MechanicalPoint; entryTangent?: MechanicalPoint; exitTangent?: MechanicalPoint
  arc?: Extract<CableSegment, { kind: 'arc' }>
}

/** Explicit safety geometry only: no tripping, braking, deceleration or certification decisions. */
export function createPassengerSafetyModel(
  data: PassengerSafetyData | undefined, installation: PassengerInstallationModel,
  layout: PassengerMechanicalLayout, components: PassengerMechanicalComponentModel,
  machine?: TractionMachineModel,
): PassengerSafetyModel {
  const issues: ValidationIssue<SafetyIssueCode>[] = [], missingData: string[] = []
  const issue = (code: SafetyIssueCode, path: string) => {
    issues.push({ code, severity: 'error', path: ['mechanical', 'safety', ...path.split('.')], messageKey: `safety.${code}` })
    return false
  }
  const inside = (bounds: MechanicalBounds, path: string, pitOnly = false) => {
    const shaft = installation.shaft, bottom = layout.zones.find((z) => z.kind === 'bottom')?.bottomY
    const top = layout.zones.find((z) => z.kind === 'top')?.topY
    return ((!shaft || (bounds.min[0] >= -shaft.width / 2 - GEOMETRY_EPSILON && bounds.max[0] <= shaft.width / 2 + GEOMETRY_EPSILON &&
      bounds.min[2] >= -shaft.depth / 2 - GEOMETRY_EPSILON && bounds.max[2] <= shaft.depth / 2 + GEOMETRY_EPSILON)) &&
      (bottom === undefined || bounds.min[1] >= bottom - GEOMETRY_EPSILON) &&
      (top === undefined || bounds.max[1] <= top + GEOMETRY_EPSILON) && (!pitOnly || bounds.max[1] <= GEOMETRY_EPSILON)) || issue('outside-safety-envelope', path)
  }
  const wheelAssembly = (kind: 'governor' | 'tension', record: SafetyWheelAssemblyData | undefined): SafetyWheelAssemblyModel | undefined => {
    if (!record) return undefined
    if (kind === 'tension' && record.wheel.id === data?.governor?.wheel.id) { issue('invalid-safety-shape', kind); return undefined }
    const wheel = createSheaveModel({ ...record.wheel, role: kind })
    if (!wheel || !positiveDriveDimensions([record.shaftLengthMm]) || mm(record.shaftLengthMm) < wheel.hubWidth ||
      ![...record.housing, record.base, ...(record.tensionDevice ? [record.tensionDevice] : [])].every(validBox) ||
      !record.supports.every((b) => validBox(b) && Number.isFinite(b.rotationYRad))) { issue('invalid-safety-shape', kind); return undefined }
    if (!installation.shaft || (kind === 'tension' && !installation.pit)) { missingData.push(`mechanical.safety.${kind}.mountContext`); return undefined }
    const at = (local: MechanicalPoint) => transformDrivePoint(local, wheel.center, wheel.rotationY)
    const housing = record.housing.map((b, i) => box(`${kind}-housing-${i}`, record.source, at(toDrivePoint(b.centerMm)), toDriveSize(b.sizeMm), wheel.rotationY, kind))
    const base = box(`${kind}-base`, record.source, at(toDrivePoint(record.base.centerMm)), toDriveSize(record.base.sizeMm), wheel.rotationY, kind)
    const supports = record.supports.map((b, i) => box(`${kind}-support-${i}`, record.source, toDrivePoint(b.centerMm), toDriveSize(b.sizeMm), b.rotationYRad, kind))
    const boxes = [...housing, base, ...supports, ...(record.tensionDevice ? [box(`${kind}-tension-device`, record.source,
      at(toDrivePoint(record.tensionDevice.centerMm)), toDriveSize(record.tensionDevice.sizeMm), wheel.rotationY, 'tension')] : [])]
    const half = mm(record.shaftLengthMm) / 2
    const shaft = cylinder(`${kind}-shaft`, record.source, at(p(0, 0, -half)), at(p(0, 0, half)), wheel.shaftDiameter)
    const partBounds = boxes.map(componentBoxBounds), visited = new Set<number>(), pending = [housing.length]
    while (pending.length) {
      const i = pending.pop()!
      if (visited.has(i)) continue
      visited.add(i)
      partBounds.forEach((b, j) => { if (!visited.has(j) && touches(b, partBounds[i])) pending.push(j) })
    }
    const mounted = supports.some((_, i) => {
      const index = housing.length + 1 + i, b = partBounds[index]
      if (!visited.has(index)) return false
      return kind === 'tension' ? nearDriveValue(b.min[1], layout.zones.find((z) => z.kind === 'bottom')?.bottomY ?? NaN)
        : nearDriveValue(b.min[0], -installation.shaft!.width / 2) || nearDriveValue(b.max[0], installation.shaft!.width / 2) ||
          nearDriveValue(b.min[2], -installation.shaft!.depth / 2) || nearDriveValue(b.max[2], installation.shaft!.depth / 2)
    })
    if (!mounted || visited.size !== boxes.length || !housing.some((b) => touches(componentBoxBounds(b), shaft.bounds))) {
      issue('unmounted-safety-wheel', kind); return undefined
    }
    const bounds = boundsOf(boxes, [wheel.bounds, shaft.bounds]), topZone = layout.zones.find((z) => z.kind === 'top')
    if (!inside(bounds, kind, kind === 'tension')) return undefined
    if (kind === 'governor' && topZone && bounds.min[1] < topZone.bottomY - GEOMETRY_EPSILON) { issue('outside-safety-envelope', kind); return undefined }
    return { kind, source: record.source, reference: record.reference, wheel, boxes, shaft, bounds }
  }
  const governor = wheelAssembly('governor', data?.governor), tension = wheelAssembly('tension', data?.tension)
  const gears: SafetyGearModel[] = []
  for (const [i, record] of (data?.gears ?? []).entries()) {
    const path = `gears.${i}`, rail = components.carRails?.find((r) => r.id === record.railId)
    if (!rail) { issue('missing-safety-rail', path); continue }
    const otherRail = components.carRails?.find((r) => r.id !== rail.id)
    // Left/right are the negative/positive sides of the explicit transverse pair, including Z-oriented frames.
    const transverse = otherRail && Math.abs(rail.origin[2] - otherRail.origin[2]) > Math.abs(rail.origin[0] - otherRail.origin[0]) ? 2 : 0
    if (!otherRail || (record.side === 'left' ? rail.origin[transverse] >= otherRail.origin[transverse] : rail.origin[transverse] <= otherRail.origin[transverse])) {
      issue('missing-safety-rail', path); continue
    }
    if (gears.some((g) => g.id === record.id || g.side === record.side || g.railId === record.railId)) { issue('duplicate-safety-gear', path); continue }
    if (record.kind !== 'generic') { issue('unsupported-safety-gear', path); continue }
    const gear = gearShape(record, rail)
    if (!gear) { issue('invalid-safety-shape', path); continue }
    const sling = components.carSling
    if (!sling) { missingData.push(`mechanical.safety.${path}.carSling`); continue }
    const mounting = componentBoxBounds(gear.boxes.at(-1)!)
    const attached = sling.boxes.some((part) => {
      const b = componentBoxBounds(part)
      return inBounds(gear.mountPoint, b) && touches(mounting, b) &&
        mounting.min[1] >= b.min[1] - GEOMETRY_EPSILON && mounting.max[1] <= b.max[1] + GEOMETRY_EPSILON &&
        [0, 2].some((axis) => nearDriveValue(gear.mountPoint[axis], b.min[axis]) || nearDriveValue(gear.mountPoint[axis], b.max[axis]))
    })
    const cabin = layout.carFrame?.cabinBounds
    if (!attached || gear.bounds.min[1] < rail.origin[1] || gear.bounds.max[1] > rail.origin[1] + rail.length ||
      (cabin && gear.boxes.some((b) => driveBoundsOverlap(componentBoxBounds(b), cabin)))) { issue('detached-safety-gear', path); continue }
    if (inside(gear.bounds, path)) gears.push(gear)
  }

  let linkage: GovernorLinkageModel | undefined
  const l = data?.linkage
  if (l) {
    if (l.rodDiameterMm === undefined || !l.paths?.length) missingData.push('mechanical.safety.linkage')
    else if (!positiveDriveDimensions([l.rodDiameterMm]) || !validBox(l.clamp) || !Number.isFinite(l.clamp.rotationYRad) || !Object.values(l.ropeConnectionMm).every(Number.isFinite)) issue('invalid-safety-linkage', 'linkage')
    else {
      const errorCount = issues.length, connection = toDrivePoint(l.ropeConnectionMm)
      const clamp = box(`${l.id}-clamp`, l.source, toDrivePoint(l.clamp.centerMm), toDriveSize(l.clamp.sizeMm), l.clamp.rotationYRad, 'linkage')
      const paths: { gearId: string; points: readonly MechanicalPoint[] }[] = [], uniqueRods = new Map<string, SafetyCylinder>()
      if (!inBounds(connection, componentBoxBounds(clamp))) issue('invalid-safety-linkage', 'linkage.clamp')
      for (const [i, path] of l.paths.entries()) {
        const gear = gears.find((g) => g.id === path.gearId), points = path.pointsMm.map(toDrivePoint)
        if (!gear || !points.every((point) => point.every(Number.isFinite)) || points.length < 2 ||
          driveDistance(points[0], gear.linkagePoint) > GEOMETRY_EPSILON || driveDistance(points.at(-1)!, connection) > GEOMETRY_EPSILON) { issue('invalid-safety-linkage', `linkage.paths.${i}`); continue }
        paths.push({ gearId: gear.id, points })
        for (let j = 1; j < points.length; j++) {
          if (driveDistance(points[j - 1], points[j]) < GEOMETRY_EPSILON) { issue('zero-length-safety-route', `linkage.paths.${i}.${j}`); continue }
          if (layout.carFrame && ropeSegmentIntersects(points[j - 1], points[j], layout.carFrame.cabinBounds, mm(l.rodDiameterMm) / 2)) { issue('invalid-safety-linkage', `linkage.paths.${i}.${j}`); continue }
          const key = [points[j - 1].join(','), points[j].join(',')].sort().join(':')
          if (!uniqueRods.has(key)) uniqueRods.set(key, cylinder(`${l.id}-rod-${uniqueRods.size}`, l.source, points[j - 1], points[j], mm(l.rodDiameterMm)))
        }
      }
      if (gears.length !== 2 || paths.length !== gears.length || new Set(paths.map((path) => path.gearId)).size !== gears.length) issue('invalid-safety-linkage', 'linkage.paths')
      const rods = [...uniqueRods.values()], bounds = boundsOf([clamp], rods.map((rod) => rod.bounds))
      if (issues.length === errorCount && inside(bounds, 'linkage')) linkage = { id: l.id, source: l.source, reference: l.reference, ropeConnection: connection, clamp, paths, rods, bounds }
    }
  }

  let governorRope: GovernorRopeModel | undefined
  const rope = data?.governorRope
  if (rope) {
    if (rope.diameterMm !== undefined && !positiveDriveDimensions([rope.diameterMm])) issue('invalid-governor-rope', 'governorRope.diameterMm')
    else if (rope.diameterMm === undefined || !rope.route || !governor || !tension || !linkage) missingData.push('mechanical.safety.governorRope')
    else {
      const errorCount = issues.length, diameter = mm(rope.diameterMm), pieces: RoutePiece[] = [], contacts: ('governor' | 'tension')[] = []
      let linkageCount = 0
      for (const [i, node] of rope.route.entries()) {
        if (node.kind === 'contact') {
          const wheel = node.wheel === 'governor' ? governor.wheel : tension.wheel, sweep = node.exitAngleRad - node.entryAngleRad
          if (wheel.grooveOffsets.length !== 1 || wheel.grooveWidth === undefined || diameter >= wheel.grooveWidth || !Number.isFinite(sweep) || Math.abs(sweep) > 2 * Math.PI || Math.abs(sweep) < GEOMETRY_EPSILON) {
            issue(Math.abs(sweep) < GEOMETRY_EPSILON ? 'zero-length-safety-route' : 'invalid-governor-rope', `governorRope.route.${i}`); break
          }
          contacts.push(node.wheel)
          const arc: Extract<CableSegment, { kind: 'arc' }> = { kind: 'arc', sheaveId: wheel.id, center: wheel.center, rotationY: wheel.rotationY,
            radius: metres(wheel.diameter / 2 - wheel.grooveDepth! + diameter / 2), axialOffset: wheel.grooveOffsets[0], entryAngle: node.entryAngleRad, exitAngle: node.exitAngleRad }
          pieces.push({ start: sheaveContactPoint(wheel, node.entryAngleRad, arc.axialOffset, diameter), end: sheaveContactPoint(wheel, node.exitAngleRad, arc.axialOffset, diameter), arc,
            entryTangent: sheaveContactTangent(wheel, node.entryAngleRad, Math.sign(sweep)), exitTangent: sheaveContactTangent(wheel, node.exitAngleRad, Math.sign(sweep)) })
        } else {
          if (node.kind === 'linkage' && node.linkageId !== linkage.id) { issue('invalid-governor-rope', `governorRope.route.${i}`); break }
          const point = node.kind === 'linkage' ? linkage.ropeConnection : toDrivePoint(node.positionMm)
          if (node.kind === 'linkage') linkageCount++
          if (!point.every(Number.isFinite)) { issue('invalid-governor-rope', `governorRope.route.${i}`); break }
          pieces.push({ start: point, end: point })
        }
      }
      if (contacts.length !== 2 || new Set(contacts).size !== 2 || linkageCount !== 1) issue('invalid-governor-rope', 'governorRope.connections')
      const segments: CableSegment[] = [], points: MechanicalPoint[] = []
      if (issues.length === errorCount) {
        pieces.forEach((piece, i) => {
          if (i === 0) points.push(piece.start)
          if (piece.arc) {
            const arc = piece.arc, samples = Math.ceil(Math.abs(arc.exitAngle - arc.entryAngle) / (Math.PI / 24))
            segments.push(arc)
            for (let k = 1; k <= samples; k++) {
              const angle = arc.entryAngle + (arc.exitAngle - arc.entryAngle) * k / samples
              points.push(transformDrivePoint(p(arc.radius * Math.cos(angle), arc.radius * Math.sin(angle), arc.axialOffset), arc.center, arc.rotationY))
            }
          }
          const next = pieces[(i + 1) % pieces.length], previous = pieces[(i + pieces.length - 1) % pieces.length], direction = delta(piece.end, next.start)
          if (driveDistance(piece.end, next.start) < GEOMETRY_EPSILON) { issue('zero-length-safety-route', `governorRope.route.${i}`); return }
          if ((piece.exitTangent && !aligned(piece.exitTangent, direction)) || (next.entryTangent && !aligned(direction, next.entryTangent)) ||
            (!piece.arc && !aligned(delta(previous.end, piece.start), direction))) { issue('non-tangent-safety-route', `governorRope.route.${i}`); return }
          segments.push({ kind: 'line', start: piece.end, end: next.start }); points.push(next.start)
        })
      }
      const solids = [layout.carFrame?.cabinBounds, layout.counterweight?.bounds,
        ...components.carSling?.boxes.map(componentBoxBounds) ?? [], ...components.counterweightFrame?.boxes.map(componentBoxBounds) ?? [],
        ...governor.boxes.map(componentBoxBounds), ...tension.boxes.map(componentBoxBounds),
        ...machine?.boxes.map(componentBoxBounds) ?? []].filter((b): b is MechanicalBounds => !!b)
      if (points.slice(1).some((point, i) => solids.some((solid) => ropeSegmentIntersects(points[i], point, solid, diameter / 2)))) issue('safety-rope-intersects-solid', 'governorRope.route')
      if (issues.length === errorCount) {
        const bounds = createMechanicalBounds(points.flatMap((point) => [p(point[0] - diameter / 2, point[1] - diameter / 2, point[2] - diameter / 2),
          p(point[0] + diameter / 2, point[1] + diameter / 2, point[2] + diameter / 2)]))
        if (inside(bounds, 'governorRope')) governorRope = { source: rope.source, reference: rope.reference, diameter, closed: true, contacts, linkageId: linkage.id, segments, points, bounds }
      }
    }
  }

  let machineBrake: MachineBrakeModel | undefined
  const brake = data?.machineBrake
  if (brake) {
    if (!machine) missingData.push('mechanical.safety.machineBrake.machine')
    else {
      const wheel = createSheaveModel({ ...brake.wheel, role: 'brake' }), mount = machine.boxes.find((b) => b.id === brake.machineMountPartId)
      const validParts = brake.parts.every(validBox)
      if (!wheel || !mount || !validParts || wheel.id === governor?.wheel.id || wheel.id === tension?.wheel.id) issue('invalid-machine-brake', 'machineBrake')
      else {
        const d = delta(machine.shaftCenter, wheel.center), along = d.reduce((sum, v, i) => sum + v * machine.shaftAxis[i], 0)
        const boxes = brake.parts.map((b, i) => box(`machine-brake-${b.role}-${i}`, brake.source,
          transformDrivePoint(toDrivePoint(b.centerMm), wheel.center, wheel.rotationY), toDriveSize(b.sizeMm), wheel.rotationY, 'brake'))
        const partBounds = boxes.map(componentBoxBounds), visited = new Set<number>(), pending = partBounds.flatMap((b, i) => touches(b, componentBoxBounds(mount)) ? [i] : [])
        while (pending.length) {
          const i = pending.pop()!
          if (visited.has(i)) continue
          visited.add(i)
          partBounds.forEach((b, j) => { if (!visited.has(j) && touches(b, partBounds[i])) pending.push(j) })
        }
        const coherent = aligned(machine.shaftAxis, wheel.axis) && d.every((v, i) => nearDriveValue(v, along * machine.shaftAxis[i])) &&
          Math.abs(along) + wheel.hubWidth / 2 <= machine.shaftLength / 2 + GEOMETRY_EPSILON && nearDriveValue(wheel.shaftDiameter, machine.shaftDiameter)
        const bounds = boundsOf(boxes, [wheel.bounds])
        if (!coherent || visited.size !== boxes.length || !partBounds.some((b) => touches(b, wheel.bounds))) issue('invalid-machine-brake', 'machineBrake')
        else if (inside(bounds, 'machineBrake')) machineBrake = { source: brake.source, reference: brake.reference, kind: 'generic', machineMountPartId: mount.id, wheel, boxes, bounds }
      }
    }
  }
  if (data) {
    for (const [key, model] of [['governor', governor], ['tension', tension], ['gears', gears.length === 2], ['linkage', linkage], ['governorRope', governorRope]] as const) {
      if (!model && !issues.some((entry) => entry.path?.[2] === key)) missingData.push(`mechanical.safety.${key}`)
    }
  }
  const bounds = [governor?.bounds, tension?.bounds, ...gears.map((g) => g.bounds), linkage?.bounds, governorRope?.bounds, machineBrake?.bounds].filter((b): b is MechanicalBounds => !!b)
  return { governor, tension, gears, linkage, governorRope, machineBrake,
    bounds: bounds.length ? createMechanicalBounds(bounds.flatMap((b) => [b.min, b.max])) : undefined,
    missingData: [...new Set(missingData)], validation: { state: issues.length ? 'invalid' : missingData.length ? 'incomplete' : 'valid', issues } }
}
