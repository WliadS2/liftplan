import type { ComponentDataSource } from '../../../../elevator/configuration/mechanical-component-data'
import type { HitchData, RopeRouteNode, TractionDriveData, TractionMachineData } from '../../../../elevator/configuration/traction-drive-data'
import { metres, millimetresToMetres, type Metres, type TechnicalValidationResult, type ValidationIssue } from '../../../../engineering'
import type { PassengerInstallationModel } from '../passenger-installation-model'
import type { ComponentBox, MechanicalMaterialRole, PassengerMechanicalComponentModel } from './mechanical-component-model'
import { componentBoxBounds } from './mechanical-component-model'
import { createMechanicalBounds, type MechanicalBounds, type MechanicalPoint, type PassengerMechanicalLayout } from './passenger-mechanical-layout'
import { createSheaveModel, sheaveContactPoint, sheaveContactTangent, type SheaveModel } from './sheave-model'
import {
  drivePoint as p, toDrivePoint, toDriveSize, transformDrivePoint, positiveDriveDimensions,
  driveBoxBounds, driveBoundsOverlap, nearDriveValue, driveDistance, ropeSegmentIntersects, GEOMETRY_EPSILON,
} from './drive-geometry'

export interface DriveCylinder {
  readonly id: string
  readonly source: ComponentDataSource
  readonly material: MechanicalMaterialRole
  readonly center: MechanicalPoint
  readonly radius: Metres
  readonly length: Metres
  readonly rotation: readonly [number, number, number]
  readonly bounds: MechanicalBounds
}
export interface TractionMachineModel {
  readonly source: ComponentDataSource
  readonly reference?: string
  readonly origin: MechanicalPoint
  readonly rotationY: number
  readonly shaftAxis: MechanicalPoint
  readonly shaftCenter: MechanicalPoint
  readonly shaftLength: Metres
  readonly shaftDiameter: Metres
  readonly housingBounds: MechanicalBounds
  readonly baseBounds: MechanicalBounds
  readonly boxes: readonly ComponentBox[]
  readonly cylinders: readonly DriveCylinder[]
  readonly bounds: MechanicalBounds
}
export interface HitchModel {
  readonly id: string
  readonly attachment: HitchData['attachment']
  readonly kind: HitchData['kind']
  readonly source: ComponentDataSource
  readonly reference?: string
  readonly plate: ComponentBox
  readonly anchor: MechanicalPoint
  readonly rotationY: number
  readonly terminationDiameter: Metres
  readonly terminationLength: Metres
  readonly bounds: MechanicalBounds
}
export type RopeSegment =
  | { readonly kind: 'line'; readonly start: MechanicalPoint; readonly end: MechanicalPoint }
  | { readonly kind: 'arc'; readonly sheaveId: string; readonly center: MechanicalPoint; readonly rotationY: number;
      readonly radius: Metres; readonly axialOffset: Metres; readonly entryAngle: number; readonly exitAngle: number }
export interface RopePathModel {
  readonly id: string
  readonly grooveIndex: number
  readonly laneOffset: Metres
  readonly diameter: Metres
  readonly segments: readonly RopeSegment[]
  readonly points: readonly MechanicalPoint[]
  readonly contacts: readonly string[]
  readonly startHitchId: string
  readonly endHitchId: string
}
export interface SuspensionModel {
  readonly source: ComponentDataSource
  readonly reference?: string
  readonly ratio: '1:1' | '2:1'
  readonly ropeCount: number
  readonly ropeDiameter: Metres
  readonly route: readonly RopeRouteNode[]
  readonly carConnectionId: string
  readonly counterweightConnectionId: string
  readonly ropes: readonly RopePathModel[]
  readonly terminations: readonly DriveCylinder[]
  readonly bounds: MechanicalBounds
}
export type DriveIssueCode = 'invalid-drive-shape' | 'outside-drive-envelope' | 'unsupported-machine'
  | 'machine-sheave-axis-mismatch' | 'invalid-suspension-data' | 'missing-route-reference'
  | 'zero-length-route' | 'non-tangent-route' | 'rope-intersects-solid' | 'unsupported-hitch'
export interface TractionDriveModel {
  readonly machine?: TractionMachineModel
  readonly supports: readonly ComponentBox[]
  readonly sheaves: readonly SheaveModel[]
  readonly hitches: readonly HitchModel[]
  readonly suspension?: SuspensionModel
  readonly bounds?: MechanicalBounds
  readonly missingData: readonly string[]
  readonly validation: TechnicalValidationResult<DriveIssueCode>
}

const mm = millimetresToMetres
const box = (id: string, source: ComponentDataSource, material: MechanicalMaterialRole,
  center: MechanicalPoint, size: MechanicalPoint, rotationY = 0): ComponentBox => ({ id, source, material, center, size, rotationY })
const partsBounds = (boxes: readonly ComponentBox[], cylinders: readonly DriveCylinder[] = []) =>
  createMechanicalBounds([...boxes.map(componentBoxBounds), ...cylinders.map((c) => c.bounds)].flatMap((b) => [b.min, b.max]))

function machineShape(data: TractionMachineData): TractionMachineModel | undefined {
  const origin = toDrivePoint(data.originMm), rotation = data.rotationYRad
  const at = (local: MechanicalPoint) => transformDrivePoint(local, origin, rotation)
  const records = [data.housing, data.bearingSupport, data.base]
  if (!origin.every(Number.isFinite) || !Number.isFinite(rotation) ||
    !records.every((b) => Object.values(b.centerMm).every(Number.isFinite) && positiveDriveDimensions(Object.values(b.sizeMm))) ||
    ![data.motor, data.shaft].every((c) => Object.values(c.centerMm).every(Number.isFinite) && positiveDriveDimensions([c.diameterMm, c.lengthMm]))) return undefined
  const boxes = records.map((b, i) => box(['machine-housing', 'machine-bearing-support', 'machine-base'][i],
    data.source, i === 2 ? 'support' : 'machine', at(toDrivePoint(b.centerMm)), toDriveSize(b.sizeMm), rotation))
  const cylinders = [data.motor, data.shaft].map((c, i): DriveCylinder => {
    const radius = metres(mm(c.diameterMm) / 2), length = mm(c.lengthMm), center = at(toDrivePoint(c.centerMm))
    return { id: i === 0 ? 'machine-motor' : 'machine-shaft', source: data.source, material: i === 0 ? 'machine' : 'sheave',
      center, radius, length, rotation: [Math.PI / 2, 0, -rotation],
      bounds: driveBoxBounds(center, p(radius * 2, radius * 2, length), rotation) }
  })
  const shaft = cylinders[1]
  const housingBounds = componentBoxBounds(boxes[0]), bearingBounds = componentBoxBounds(boxes[1]), baseBounds = componentBoxBounds(boxes[2])
  const touches = (a: MechanicalBounds, b: MechanicalBounds) => [0, 1, 2].every((i) => a.min[i] <= b.max[i] + GEOMETRY_EPSILON && a.max[i] >= b.min[i] - GEOMETRY_EPSILON)
  if (!touches(housingBounds, baseBounds) || !touches(bearingBounds, baseBounds) || !touches(housingBounds, bearingBounds) ||
    !touches(cylinders[0].bounds, housingBounds) || !driveBoundsOverlap(shaft.bounds, bearingBounds)) return undefined
  return { source: data.source, reference: data.reference, origin, rotationY: rotation,
    shaftAxis: p(Math.sin(rotation), 0, Math.cos(rotation)), shaftCenter: shaft.center,
    shaftLength: shaft.length, shaftDiameter: metres(shaft.radius * 2),
    housingBounds, baseBounds,
    boxes, cylinders, bounds: partsBounds(boxes, cylinders) }
}

function hitchShape(data: HitchData): HitchModel | undefined {
  if (data.kind !== 'generic' || !Object.values(data.originMm).every(Number.isFinite) ||
    !Object.values(data.anchorMm).every(Number.isFinite) || !Object.values(data.plate.centerMm).every(Number.isFinite) ||
    !Number.isFinite(data.rotationYRad) || !positiveDriveDimensions([...Object.values(data.plate.sizeMm), data.terminationDiameterMm, data.terminationLengthMm])) return undefined
  const origin = toDrivePoint(data.originMm), rotation = data.rotationYRad
  const plate = box(`${data.id}-plate`, data.source, 'hitch', transformDrivePoint(toDrivePoint(data.plate.centerMm), origin, rotation), toDriveSize(data.plate.sizeMm), rotation)
  const bounds = componentBoxBounds(plate), anchor = transformDrivePoint(toDrivePoint(data.anchorMm), origin, rotation)
  const terminationLength = mm(data.terminationLengthMm), terminationDiameter = mm(data.terminationDiameterMm)
  if (!nearDriveValue(anchor[1] - terminationLength, bounds.max[1])) return undefined
  return { id: data.id, source: data.source, reference: data.reference, attachment: data.attachment, kind: data.kind,
    plate, anchor, rotationY: rotation, terminationLength, terminationDiameter,
    bounds: createMechanicalBounds([bounds.min, bounds.max, anchor]) }
}

interface RoutePiece {
  start: MechanicalPoint; end: MechanicalPoint
  entryTangent?: MechanicalPoint; exitTangent?: MechanicalPoint
  arc?: Extract<RopeSegment, { kind: 'arc' }>
}
function aligned(a: MechanicalPoint, b: MechanicalPoint) {
  const lengths = Math.hypot(...a) * Math.hypot(...b)
  return lengths > 0 && a.reduce((sum, v, i) => sum + v * b[i], 0) / lengths > 1 - GEOMETRY_EPSILON
}
const delta = (a: MechanicalPoint, b: MechanicalPoint) => p(b[0] - a[0], b[1] - a[1], b[2] - a[2])

/** No state, rendering dependencies, physical sizing formulas, or fallback dimensions. */
export function createTractionDriveModel(
  data: TractionDriveData | undefined, installation: PassengerInstallationModel,
  layout: PassengerMechanicalLayout, components: PassengerMechanicalComponentModel,
): TractionDriveModel {
  const issues: ValidationIssue<DriveIssueCode>[] = [], missingData: string[] = []
  const issue = (code: DriveIssueCode, path: string) => {
    issues.push({ code, severity: 'error', path: ['mechanical', 'drive', ...path.split('.')], messageKey: `drive.${code}` })
    return false
  }
  const inside = (bounds: MechanicalBounds, path: string) => {
    const shaft = installation.shaft
    if (!shaft) return true
    const bottom = layout.zones.find((z) => z.kind === 'bottom')?.bottomY
    const top = layout.zones.find((z) => z.kind === 'top')?.topY
    return ([0, 2].every((i) => bounds.min[i] >= -(i === 0 ? shaft.width : shaft.depth) / 2 - GEOMETRY_EPSILON &&
      bounds.max[i] <= (i === 0 ? shaft.width : shaft.depth) / 2 + GEOMETRY_EPSILON) &&
      (bottom === undefined || bounds.min[1] >= bottom - GEOMETRY_EPSILON) &&
      (top === undefined || bounds.max[1] <= top + GEOMETRY_EPSILON)) || issue('outside-drive-envelope', path)
  }
  let machine = data?.machine ? machineShape(data.machine) : undefined
  if (data?.machine && !machine) issue('invalid-drive-shape', 'machine')
  const supports: ComponentBox[] = []
  for (const [i, support] of (data?.mount?.supports ?? []).entries()) {
    if (!positiveDriveDimensions(Object.values(support.sizeMm)) || !Object.values(support.centerMm).every(Number.isFinite) || !Number.isFinite(support.rotationYRad)) { issue('invalid-drive-shape', `mount.${i}`); continue }
    const part = box(`machine-support-${i}`, data!.mount!.source, 'support', toDrivePoint(support.centerMm), toDriveSize(support.sizeMm), support.rotationYRad)
    if (inside(componentBoxBounds(part), `mount.${i}`)) supports.push(part)
  }
  if (machine) {
    const base = machine.baseBounds
    const supportBounds = supports.map(componentBoxBounds)
    const visited = new Set<number>(), pending = supportBounds.flatMap((b, i) =>
      nearDriveValue(b.max[1], base.min[1]) && [0, 2].every((axis) => b.max[axis] > base.min[axis] && b.min[axis] < base.max[axis]) ? [i] : [])
    while (pending.length) {
      const i = pending.pop()!
      if (visited.has(i)) continue
      visited.add(i)
      supportBounds.forEach((b, j) => {
        if (!visited.has(j) && [0, 1, 2].every((axis) => b.min[axis] <= supportBounds[i].max[axis] + GEOMETRY_EPSILON && b.max[axis] >= supportBounds[i].min[axis] - GEOMETRY_EPSILON)) pending.push(j)
      })
    }
    const supported = [...visited].some((i) => {
      const b = supportBounds[i]
      const shaft = installation.shaft
      // Explicit support connectivity only, not load capacity or anchorage design.
      const anchored = !shaft || nearDriveValue(b.min[0], -shaft.width / 2) || nearDriveValue(b.max[0], shaft.width / 2) ||
        nearDriveValue(b.min[2], -shaft.depth / 2) || nearDriveValue(b.max[2], shaft.depth / 2)
      return anchored
    })
    if (!supported) { missingData.push('mechanical.drive.mount'); issue('unsupported-machine', 'machine'); machine = undefined }
    else if (!inside(machine.bounds, 'machine')) machine = undefined
  }
  const sheaves: SheaveModel[] = []
  for (const [i, record] of (data?.sheaves ?? []).entries()) {
    const sheave = createSheaveModel(record)
    if (!sheave || sheaves.some((s) => s.id === record.id)) issue('invalid-drive-shape', `sheaves.${i}`)
    else if (inside(sheave.bounds, `sheaves.${i}`)) sheaves.push(sheave)
  }
  const traction = sheaves.filter((s) => s.role === 'traction')
  if (machine && traction.length) {
    const shaft = machine
    const coherent = traction.length === 1 && (() => {
      const s = traction[0], d = delta(shaft.shaftCenter, s.center)
      const along = d.reduce((sum, v, i) => sum + v * shaft.shaftAxis[i], 0)
      return aligned(shaft.shaftAxis, s.axis) &&
        d.every((v, i) => nearDriveValue(v, along * shaft.shaftAxis[i])) &&
        Math.abs(along) + s.hubWidth / 2 <= shaft.shaftLength / 2 + GEOMETRY_EPSILON && nearDriveValue(s.shaftDiameter, shaft.shaftDiameter)
    })()
    if (!coherent) { issue('machine-sheave-axis-mismatch', 'machine'); machine = undefined }
  }
  const hitches: HitchModel[] = []
  for (const [i, record] of (data?.hitches ?? []).entries()) {
    const hitch = hitchShape(record)
    if (!hitch || hitches.some((h) => h.id === record.id)) { issue(record.kind === 'generic' ? 'invalid-drive-shape' : 'unsupported-hitch', `hitches.${i}`); continue }
    const frame = hitch.attachment === 'car' ? components.carSling?.bounds : hitch.attachment === 'counterweight' ? components.counterweightFrame?.bounds : undefined
    const plateBounds = componentBoxBounds(hitch.plate)
    if (frame && (!nearDriveValue(plateBounds.min[1], frame.max[1]) || ![0, 2].every((axis) => plateBounds.min[axis] >= frame.min[axis] - GEOMETRY_EPSILON && plateBounds.max[axis] <= frame.max[axis] + GEOMETRY_EPSILON))) {
      issue('invalid-drive-shape', `hitches.${i}`); continue
    }
    if (inside(hitch.bounds, `hitches.${i}`)) hitches.push(hitch)
  }
  let suspension: SuspensionModel | undefined
  const supplied = data?.suspension
  if (data) {
    if (!data.machine) missingData.push('mechanical.drive.machine')
    if (!data.sheaves?.some((s) => s.role === 'traction')) missingData.push('mechanical.drive.sheaves')
    if (!supplied) missingData.push('mechanical.drive.suspension')
  }
  if (supplied) {
    const { ratio, ropeCount, ropeDiameterMm, grooveIndices, route, carConnectionId, counterweightConnectionId } = supplied
    if ((ropeCount !== undefined && (!Number.isInteger(ropeCount) || ropeCount <= 0 || ropeCount > 64)) ||
      (ropeDiameterMm !== undefined && !positiveDriveDimensions([ropeDiameterMm]))) {
      issue('invalid-suspension-data', 'suspension')
    } else if (!ratio || ropeCount === undefined || ropeDiameterMm === undefined || !grooveIndices || !route || !carConnectionId || !counterweightConnectionId) {
      missingData.push('mechanical.drive.suspension')
    } else if (!Number.isInteger(ropeCount) || ropeCount <= 0 || ropeCount > 64 || !positiveDriveDimensions([ropeDiameterMm]) ||
      grooveIndices.length !== ropeCount || new Set(grooveIndices).size !== ropeCount || traction.length !== 1) {
      issue('invalid-suspension-data', 'suspension')
    } else {
      const errorCount = issues.length
      const diameter = mm(ropeDiameterMm), ropes: RopePathModel[] = [], terminations: DriveCylinder[] = []
      const first = route[0], last = route.at(-1)
      const startHitch = first?.kind === 'hitch' ? hitches.find((h) => h.id === first.hitchId) : undefined
      const endHitch = last?.kind === 'hitch' ? hitches.find((h) => h.id === last.hitchId) : undefined
      const contactIds = route.filter((n) => n.kind === 'contact').map((n) => n.sheaveId)
      const correctConnections = ratio === '1:1'
        ? startHitch?.id === carConnectionId && startHitch.attachment === 'car' && endHitch?.id === counterweightConnectionId && endHitch.attachment === 'counterweight'
        : startHitch?.attachment === 'fixed' && endHitch?.attachment === 'fixed' &&
          sheaves.some((s) => s.id === carConnectionId && s.role === 'car') && sheaves.some((s) => s.id === counterweightConnectionId && s.role === 'counterweight') &&
          contactIds.includes(carConnectionId) && contactIds.includes(counterweightConnectionId)
      if (!startHitch || !endHitch || startHitch.id === endHitch.id || !correctConnections || !contactIds.includes(traction[0].id)) issue('invalid-suspension-data', 'suspension.connections')
      const solids = [layout.carFrame?.cabinBounds, layout.counterweight?.bounds, ...(machine?.boxes.map(componentBoxBounds) ?? []),
        ...supports.map(componentBoxBounds)].filter((b): b is MechanicalBounds => !!b)
      for (let index = 0; index < ropeCount && issues.length === errorCount; index++) {
        const grooveIndex = grooveIndices[index], main = traction[0]
        const offset = main.grooveOffsets[grooveIndex]
        if (offset === undefined) { issue('invalid-suspension-data', 'suspension.grooveIndices'); break }
        const pieces: RoutePiece[] = []
        for (const [nodeIndex, node] of route.entries()) {
          if (node.kind === 'hitch') {
            const hitch = hitches.find((h) => h.id === node.hitchId)
            if (!hitch || (nodeIndex !== 0 && nodeIndex !== route.length - 1)) { issue('missing-route-reference', `suspension.route.${nodeIndex}`); break }
            const anchor = transformDrivePoint(p(0, 0, offset), hitch.anchor, hitch.rotationY)
            const center = p(anchor[0], anchor[1] - hitch.terminationLength / 2, anchor[2])
            const cylinderBounds = driveBoxBounds(center, p(hitch.terminationDiameter, hitch.terminationLength, hitch.terminationDiameter))
            const plateBounds = componentBoxBounds(hitch.plate)
            if (![0, 2].every((i) => cylinderBounds.min[i] >= plateBounds.min[i] - GEOMETRY_EPSILON && cylinderBounds.max[i] <= plateBounds.max[i] + GEOMETRY_EPSILON)) { issue('invalid-suspension-data', 'suspension.terminations'); break }
            terminations.push({ id: `${hitch.id}-termination-${index}`, source: hitch.source, material: 'hitch', center,
              radius: metres(hitch.terminationDiameter / 2), length: hitch.terminationLength, rotation: [0, 0, 0], bounds: cylinderBounds })
            pieces.push({ start: anchor, end: anchor })
          } else if (node.kind === 'point') {
            const point = transformDrivePoint(p(0, 0, offset), toDrivePoint(node.positionMm), main.rotationY)
            if (!point.every(Number.isFinite)) { issue('invalid-suspension-data', `suspension.route.${nodeIndex}`); break }
            pieces.push({ start: point, end: point })
          } else {
            const sheave = sheaves.find((s) => s.id === node.sheaveId)
            if (!sheave) { issue('missing-route-reference', `suspension.route.${nodeIndex}`); break }
            const lane = sheave.grooveOffsets[grooveIndex], sweep = node.exitAngleRad - node.entryAngleRad
            if (lane === undefined || sheave.grooveWidth === undefined || diameter >= sheave.grooveWidth ||
              !Number.isFinite(sweep) || Math.abs(sweep) > 2 * Math.PI || Math.abs(sweep) < GEOMETRY_EPSILON) {
              issue(Math.abs(sweep) < GEOMETRY_EPSILON ? 'zero-length-route' : 'invalid-suspension-data', `suspension.route.${nodeIndex}`); break
            }
            const arc: Extract<RopeSegment, { kind: 'arc' }> = { kind: 'arc', sheaveId: sheave.id, center: sheave.center,
              rotationY: sheave.rotationY, radius: metres(sheave.diameter / 2 - sheave.grooveDepth! + diameter / 2),
              axialOffset: lane, entryAngle: node.entryAngleRad, exitAngle: node.exitAngleRad }
            pieces.push({ start: sheaveContactPoint(sheave, node.entryAngleRad, lane, diameter), end: sheaveContactPoint(sheave, node.exitAngleRad, lane, diameter),
              entryTangent: sheaveContactTangent(sheave, node.entryAngleRad, Math.sign(sweep)),
              exitTangent: sheaveContactTangent(sheave, node.exitAngleRad, Math.sign(sweep)), arc })
          }
        }
        if (issues.length !== errorCount) break
        const segments: RopeSegment[] = [], points: MechanicalPoint[] = []
        for (let j = 0; j < pieces.length; j++) {
          const piece = pieces[j], previous = pieces[j - 1]
          if (previous) {
            const direction = delta(previous.end, piece.start)
            if (driveDistance(previous.end, piece.start) < GEOMETRY_EPSILON) { issue('zero-length-route', `suspension.route.${j}`); break }
            if ((previous.exitTangent && !aligned(previous.exitTangent, direction)) || (piece.entryTangent && !aligned(direction, piece.entryTangent)) ||
              (!previous.arc && j > 1 && !aligned(delta(pieces[j - 2].end, previous.start), direction))) {
              issue('non-tangent-route', `suspension.route.${j}`); break
            }
            segments.push({ kind: 'line', start: previous.end, end: piece.start }); points.push(piece.start)
          } else points.push(piece.start)
          if (piece.arc) {
            segments.push(piece.arc)
            // Visualization tessellation only; analytic segments remain available in the contract.
            const arc = piece.arc, samples = Math.ceil(Math.abs(arc.exitAngle - arc.entryAngle) / (Math.PI / 24))
            for (let k = 1; k <= samples; k++) {
              const angle = arc.entryAngle + (arc.exitAngle - arc.entryAngle) * k / samples
              points.push(transformDrivePoint(p(arc.radius * Math.cos(angle), arc.radius * Math.sin(angle), arc.axialOffset), arc.center, arc.rotationY))
            }
          }
        }
        if (issues.length !== errorCount) break
        if (points.some((point) => !point.every(Number.isFinite))) { issue('invalid-suspension-data', 'suspension.route'); break }
        if (points.slice(1).some((point, i) => solids.some((solid) => ropeSegmentIntersects(points[i], point, solid, diameter / 2)))) {
          issue('rope-intersects-solid', 'suspension.route'); break
        }
        ropes.push({ id: `suspension-rope-${index}`, grooveIndex, laneOffset: offset, diameter, segments, points,
          contacts: contactIds, startHitchId: startHitch!.id, endHitchId: endHitch!.id })
      }
      if (issues.length === errorCount && ropes.length === ropeCount) {
        const bounds = createMechanicalBounds(ropes.flatMap((r) => r.points.flatMap((point) => [
          p(point[0] - diameter / 2, point[1] - diameter / 2, point[2] - diameter / 2),
          p(point[0] + diameter / 2, point[1] + diameter / 2, point[2] + diameter / 2),
        ])))
        if (inside(bounds, 'suspension')) suspension = { source: supplied.source, reference: supplied.reference, ratio, ropeCount,
          ropeDiameter: diameter, route, carConnectionId, counterweightConnectionId, ropes, terminations, bounds }
      }
    }
  }
  const bounds = [machine?.bounds, ...supports.map(componentBoxBounds), ...sheaves.map((s) => s.bounds),
    ...hitches.map((h) => h.bounds), suspension?.bounds].filter((b): b is MechanicalBounds => !!b)
  return { machine, supports, sheaves, hitches, suspension,
    bounds: bounds.length ? createMechanicalBounds(bounds.flatMap((b) => [b.min, b.max])) : undefined,
    missingData, validation: { state: issues.length ? 'invalid' : missingData.length ? 'incomplete' : 'valid', issues } }
}
