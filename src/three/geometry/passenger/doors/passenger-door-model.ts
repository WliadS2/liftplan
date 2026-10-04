import type { ComponentDataSource } from '../../../../elevator/configuration/mechanical-component-data'
import type {
  PassengerDoorSystemData, DoorAssemblyData, DoorCylinderData, DoorOpeningType, DoorOperatorData,
  DoorCouplingData, DoorInterlockData,
} from '../../../../elevator/configuration/passenger-door-data'
import { metres, millimetresToMetres as mm, type Metres, type TechnicalValidationResult, type ValidationIssue } from '../../../../engineering'
import type { PassengerInstallationModel, PassengerEntranceSide, PassengerLandingLevelModel } from '../passenger-installation-model'
import { componentBoxBounds, type ComponentBox, type MechanicalMaterialRole } from '../mechanical/mechanical-component-model'
import { createMechanicalBounds, type MechanicalBounds, type MechanicalPoint } from '../mechanical/passenger-mechanical-layout'
import { drivePoint as p, toDrivePoint, toDriveSize, transformDrivePoint, driveBoxBounds, driveBoundsOverlap,
  positiveDriveDimensions, nearDriveValue, driveDistance, GEOMETRY_EPSILON } from '../mechanical/drive-geometry'
import { createSheaveModel, sheaveContactPoint, sheaveContactTangent, type SheaveModel } from '../mechanical/sheave-model'
import type { CableSegment } from '../mechanical/cable-segment'

export interface DoorTransform { readonly center: MechanicalPoint; readonly rotationY: number }
export interface DoorPanelModel {
  readonly id: string; readonly index: number; readonly source: ComponentDataSource
  readonly width: Metres; readonly height: Metres; readonly thickness: Metres
  readonly closed: DoorTransform; readonly open: DoorTransform; readonly travel: MechanicalPoint
  readonly box: ComponentBox
}
export interface DoorCylinder {
  readonly id: string; readonly source: ComponentDataSource; readonly material: MechanicalMaterialRole
  readonly center: MechanicalPoint; readonly rotationY: number; readonly axisRotation: readonly [number, number, number]
  readonly scale: MechanicalPoint; readonly bounds: MechanicalBounds
}
export interface DoorPartGroup {
  readonly source: ComponentDataSource; readonly reference?: string
  readonly boxes: readonly ComponentBox[]; readonly cylinders: readonly DoorCylinder[]; readonly bounds: MechanicalBounds
}
export interface DoorOperatorModel extends DoorPartGroup {
  readonly entranceId: string; readonly transform: DoorTransform; readonly pulleys: readonly SheaveModel[]
  readonly drivePath?: { readonly source: ComponentDataSource; readonly reference?: string; readonly diameter: Metres; readonly closed: true; readonly segments: readonly CableSegment[] }
}
export interface DoorCouplingModel extends DoorPartGroup {
  readonly entranceId: string; readonly attachment: 'cabin' | 'landing'; readonly panelId: string
  readonly interfacePoint: MechanicalPoint
}
export interface DoorInterlockModel extends DoorPartGroup { readonly entranceId: string; readonly levelId: string; readonly transform: DoorTransform }
export interface DoorEntranceModel {
  readonly id: string; readonly role: 'cabin' | 'landing'; readonly side: PassengerEntranceSide
  readonly source: ComponentDataSource; readonly reference?: string; readonly levelId?: string
  readonly cabinEntranceId?: string; readonly origin: MechanicalPoint; readonly rotationY: number
  readonly openingWidth: Metres; readonly openingHeight: Metres; readonly openingType?: DoorOpeningType
  readonly outline: readonly MechanicalPoint[]; readonly panels: readonly DoorPanelModel[]
  readonly frame?: DoorPartGroup; readonly sill?: DoorPartGroup; readonly track?: DoorPartGroup
  readonly hangers?: DoorPartGroup; readonly guides?: DoorPartGroup; readonly operator?: DoorOperatorModel
  readonly coupling?: DoorCouplingModel; readonly interlock?: DoorInterlockModel; readonly bounds: MechanicalBounds
}
export interface DoorEntranceRelationship {
  readonly cabinEntranceId: string; readonly landingEntranceId: string; readonly levelId: string
  readonly cabinAtLevelOrigin: MechanicalPoint; readonly entranceAxesCorrespond: boolean
  readonly sillSeparation?: Metres; readonly interfacePointsCoincide?: boolean
}
export type DoorIssueCode = 'invalid-door-shape' | 'unsupported-door-type' | 'duplicate-door-identity'
  | 'missing-door-reference' | 'invalid-door-panel' | 'invalid-door-sill' | 'unmounted-door-component'
  | 'invalid-door-operator' | 'invalid-door-drive-path' | 'invalid-door-coupling' | 'invalid-door-interlock'
  | 'invalid-door-level' | 'entrance-axis-mismatch' | 'door-width-exceeds-cabin-entrance'
  | 'door-height-exceeds-cabin-entrance' | 'door-panel-outside-entrance'
export interface PassengerDoorSystemModel {
  readonly cabin: readonly DoorEntranceModel[]; readonly landings: readonly DoorEntranceModel[]
  readonly relationships: readonly DoorEntranceRelationship[]; readonly bounds?: MechanicalBounds
  readonly missingData: readonly string[]; readonly validation: TechnicalValidationResult<DoorIssueCode>
}
export interface DoorInspection {
  readonly level?: PassengerLandingLevelModel; readonly side: PassengerEntranceSide
  readonly landing?: DoorEntranceModel; readonly cabin?: DoorEntranceModel
  readonly cabinAtLevel: boolean; readonly bounds?: MechanicalBounds
}

/** Explicit generated attachment identities keep each carrier/guide/coupling rigidly attached to its panel. */
export function getDoorPanelParts(entry: DoorEntranceModel, panel: DoorPanelModel) {
  const index = panel.index
  return {
    boxes: [...entry.hangers?.boxes.filter((part) => part.id === `${entry.id}-carrier-${index}` || part.id === `${entry.id}-hanger-connector-${index}`) ?? [],
      ...entry.guides?.boxes.filter((part) => part.id === `${entry.id}-bottom-guide-${index}`) ?? [],
      ...entry.coupling?.panelId === panel.id ? entry.coupling.boxes : []],
    cylinders: [...entry.hangers?.cylinders.filter((part) => part.id.startsWith(`${entry.id}-hanger-${index}-`)) ?? [],
      ...entry.coupling?.panelId === panel.id ? entry.coupling.cylinders : []],
  }
}

const combine = (bounds: readonly MechanicalBounds[]) => createMechanicalBounds(bounds.flatMap((b) => [b.min, b.max]))
const touches = (a: MechanicalBounds, b: MechanicalBounds) => [0, 1, 2].every((i) => a.min[i] <= b.max[i] + GEOMETRY_EPSILON && a.max[i] >= b.min[i] - GEOMETRY_EPSILON)
const finite = (point: MechanicalPoint) => point.every(Number.isFinite)
const contained = (point: MechanicalPoint, bounds: MechanicalBounds) => point.every((v, i) => v >= bounds.min[i] - GEOMETRY_EPSILON && v <= bounds.max[i] + GEOMETRY_EPSILON)
const groupBounds = (boxes: readonly ComponentBox[], cylinders: readonly DoorCylinder[] = []) => combine([...boxes.map(componentBoxBounds), ...cylinders.map((c) => c.bounds)])
function connected(bounds: readonly MechanicalBounds[], mount: MechanicalBounds): boolean {
  const pending = bounds.flatMap((b, i) => touches(b, mount) ? [i] : []), visited = new Set<number>()
  while (pending.length) {
    const i = pending.pop()!
    if (visited.has(i)) continue
    visited.add(i)
    bounds.forEach((b, j) => { if (!visited.has(j) && touches(b, bounds[i])) pending.push(j) })
  }
  return bounds.length > 0 && visited.size === bounds.length
}

function normalizeCylinder(c: DoorCylinderData, id: string, source: ComponentDataSource, material: MechanicalMaterialRole,
  origin: MechanicalPoint, rotationY: number, offset = p(0, 0, 0)): DoorCylinder | undefined {
  if (!positiveDriveDimensions([c.diameterMm, c.lengthMm]) || !finite(toDrivePoint(c.centerMm))) return undefined
  const radius = metres(mm(c.diameterMm) / 2), length = mm(c.lengthMm)
  const local = p(...toDrivePoint(c.centerMm).map((v, i) => v + offset[i]) as [number, number, number])
  const center = transformDrivePoint(local, origin, rotationY)
  const size = c.axis === 'x' ? p(length, 2 * radius, 2 * radius) : c.axis === 'y' ? p(2 * radius, length, 2 * radius) : p(2 * radius, 2 * radius, length)
  return { id, source, material, center, rotationY,
    axisRotation: c.axis === 'x' ? [0, 0, Math.PI / 2] : c.axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0],
    scale: p(radius, length, radius), bounds: driveBoxBounds(center, size, rotationY) }
}

/** Pure static door layout: all manufactured dimensions and travel vectors are explicit inputs. */
export function createPassengerDoorSystem(data: PassengerDoorSystemData | undefined, installation: PassengerInstallationModel): PassengerDoorSystemModel {
  const issues: ValidationIssue<DoorIssueCode>[] = [], missingData: string[] = []
  const issue = (code: DoorIssueCode, id: string, field: string) => issues.push({ code, path: ['doors', id, field], severity: 'error', messageKey: `doors.${code}` })
  const cabin: DoorEntranceModel[] = [], landings: DoorEntranceModel[] = [], relationships: DoorEntranceRelationship[] = []
  const seen = new Set<string>()
  function entrance(id: string, role: 'cabin' | 'landing', side: PassengerEntranceSide, origin: MechanicalPoint,
    width: Metres, height: Metres, source: ComponentDataSource, reference: string | undefined,
    assembly?: DoorAssemblyData): DoorEntranceModel | undefined {
    if (seen.has(id)) { issue('duplicate-door-identity', id, 'id'); return undefined }
    seen.add(id)
    if (!finite(origin) || !positiveDriveDimensions([width, height])) { issue('invalid-door-shape', id, 'opening'); return undefined }
    const rotationY = side === 'front' ? 0 : Math.PI, at = (local: MechanicalPoint) => transformDrivePoint(local, origin, rotationY)
    const outline = [p(-width / 2, 0, 0), p(-width / 2, height, 0), p(width / 2, height, 0), p(width / 2, 0, 0)].map(at)
    const b = (suffix: string, center: MechanicalPoint, size: MechanicalPoint, material: MechanicalMaterialRole): ComponentBox => ({
      id: `${id}-${suffix}`, source: assembly?.source ?? source, center: at(center), size, rotationY, material,
    })
    const cylinder = (c: DoorCylinderData, suffix: string, material: MechanicalMaterialRole, centerOffset = p(0, 0, 0)): DoorCylinder | undefined => {
      const normalized = normalizeCylinder(c, `${id}-${suffix}-${c.id}`, assembly?.source ?? source, material, origin, rotationY, centerOffset)
      if (!normalized) issue('invalid-door-shape', id, suffix)
      return normalized
    }
    const g = (boxes: readonly ComponentBox[], cylinders: readonly DoorCylinder[] = [], provenance = assembly): DoorPartGroup => ({
      source: provenance?.source ?? source, reference: provenance?.reference ?? reference, boxes, cylinders, bounds: groupBounds(boxes, cylinders),
    })
    let frame: DoorPartGroup | undefined, sill: DoorPartGroup | undefined, track: DoorPartGroup | undefined
    let hangers: DoorPartGroup | undefined, guides: DoorPartGroup | undefined
    const panels: DoorPanelModel[] = []
    if (!assembly) missingData.push(`doors.${id}.assembly`)
    else {
      const f = assembly.frame
      if (f) {
        if (!positiveDriveDimensions([f.jambWidthMm, f.jambDepthMm, f.headerHeightMm, f.headerDepthMm]) || !Number.isFinite(f.depthOffsetMm)) issue('invalid-door-shape', id, 'frame')
        else frame = g([
          ...[-1, 1].map((sign) => b(`jamb-${sign}`, p(sign * (width / 2 + mm(f.jambWidthMm) / 2), height / 2, mm(f.depthOffsetMm)), p(mm(f.jambWidthMm), height, mm(f.jambDepthMm)), 'doorFrame')),
          b('header', p(0, height + mm(f.headerHeightMm) / 2, mm(f.depthOffsetMm)), p(width + 2 * mm(f.jambWidthMm), mm(f.headerHeightMm), mm(f.headerDepthMm)), 'doorFrame'),
        ])
      }
      const s = assembly.sill
      if (s) {
        const depth = mm(s.depthMm), h = mm(s.heightMm), slots = s.grooves.map((slot) => ({ start: mm(slot.depthOffsetMm) - mm(slot.widthMm) / 2, end: mm(slot.depthOffsetMm) + mm(slot.widthMm) / 2, cut: mm(slot.depthMm) })).sort((a, b) => a.start - b.start)
        if (!positiveDriveDimensions([s.widthMm, s.depthMm, s.heightMm]) || mm(s.widthMm) < width || !Number.isFinite(s.depthOffsetMm) || slots.some((slot, i) =>
          !positiveDriveDimensions([slot.end - slot.start, slot.cut]) || slot.cut >= h || slot.start < -depth / 2 || slot.end > depth / 2 || (i > 0 && slot.start < slots[i - 1].end))) issue('invalid-door-sill', id, 'sill')
        else {
          const edges = [-depth / 2, ...slots.flatMap((slot) => [slot.start, slot.end]), depth / 2]
          const pieces = edges.slice(1).flatMap((end, i) => {
            const start = edges[i], mid = (start + end) / 2, cut = slots.find((slot) => mid > slot.start && mid < slot.end)?.cut ?? 0
            return end - start > GEOMETRY_EPSILON ? [b(`sill-strip-${i}`, p(0, -(h + cut) / 2, mm(s.depthOffsetMm) + mid), p(mm(s.widthMm), h - cut, end - start), 'doorSill')] : []
          })
          sill = g(pieces)
        }
      }
      const supported = assembly.openingType === 'center-opening-2' || assembly.openingType === 'side-opening-2'
      if (!supported) issue('unsupported-door-type', id, 'openingType')
      else if (assembly.panelCount !== 2 || !positiveDriveDimensions([assembly.panelThicknessMm]) ||
        (assembly.panelOverlapMm !== undefined && (!Number.isFinite(assembly.panelOverlapMm) || assembly.panelOverlapMm < 0)) ||
        assembly.panelDepthOffsetsMm.length !== 2 || assembly.panelDepthOffsetsMm.some((v) => !Number.isFinite(v)) ||
        assembly.panelTravelMm.length !== 2 || assembly.panelTravelMm.some((v) => !finite(toDrivePoint(v))) ||
        (assembly.openingType === 'side-opening-2' && !assembly.sideOpeningDirection)) issue('invalid-door-panel', id, 'panels')
      else {
        for (let i = 0; i < 2; i++) {
          const travelLocal = toDrivePoint(assembly.panelTravelMm[i]), sign = assembly.openingType === 'center-opening-2' ? (i === 0 ? -1 : 1) : assembly.sideOpeningDirection === 'left' ? -1 : 1
          if (sign * travelLocal[0] <= 0 || !nearDriveValue(travelLocal[1], 0) || !nearDriveValue(travelLocal[2], 0)) { issue('invalid-door-panel', id, `panels.${i}.travel`); continue }
          const panelWidth = metres(width / 2 + (assembly.panelOverlapMm === undefined ? 0 : mm(assembly.panelOverlapMm)))
          const closedLocal = p((i === 0 ? -1 : 1) * width / 4, height / 2, mm(assembly.panelDepthOffsetsMm[i]))
          const part = b(`panel-${i + 1}`, closedLocal, p(panelWidth, height, mm(assembly.panelThicknessMm)), role === 'cabin' ? 'cabinDoor' : 'landingDoor')
          const openCenter = at(p(...closedLocal.map((v, axis) => v + travelLocal[axis]) as [number, number, number]))
          const center = part.center
          panels.push({ id: part.id, index: i, source: assembly.source, width: panelWidth, height, thickness: mm(assembly.panelThicknessMm),
            closed: { center, rotationY }, open: { center: openCenter, rotationY }, travel: p(...openCenter.map((v, axis) => v - center[axis]) as [number, number, number]), box: part })
        }
        if (panels.some((panel) => {
          const localX = Math.abs(panel.closed.center[0] - origin[0])
          const localBottom = panel.closed.center[1] - panel.height / 2 - origin[1]
          const localTop = panel.closed.center[1] + panel.height / 2 - origin[1]
          return localX + panel.width / 2 > width / 2 + GEOMETRY_EPSILON ||
            localBottom < -GEOMETRY_EPSILON || localTop > height + GEOMETRY_EPSILON
        })) issue('door-panel-outside-entrance', id, 'panels.closed')
        if (panels.length === 2 && driveBoundsOverlap(componentBoxBounds(panels[0].box), componentBoxBounds(panels[1].box))) { issue('invalid-door-panel', id, 'panels.overlap'); panels.length = 0 }
      }
      const t = assembly.track
      if (t) {
        if (!positiveDriveDimensions([t.widthMm, t.heightMm, t.depthMm]) || !Number.isFinite(t.aboveOpeningMm) || t.aboveOpeningMm < 0 || !Number.isFinite(t.depthOffsetMm) ||
          t.mounts.some((m) => !positiveDriveDimensions(Object.values(m.sizeMm)) || !finite(toDrivePoint(m.centerMm)))) issue('invalid-door-shape', id, 'track')
        else {
          const boxes = [b('track', p(0, height + mm(t.aboveOpeningMm), mm(t.depthOffsetMm)), p(mm(t.widthMm), mm(t.heightMm), mm(t.depthMm)), 'doorFrame'),
            ...t.mounts.map((m) => b(`track-mount-${m.id}`, p(mm(m.centerMm.xMm), height + mm(m.centerMm.yMm), mm(m.centerMm.zMm)), toDriveSize(m.sizeMm), 'doorFrame'))]
          if (!frame || !connected(boxes.map(componentBoxBounds), frame.bounds)) issue('unmounted-door-component', id, 'track')
          else track = g(boxes)
        }
      }
      const hanger = assembly.hanger
      if (hanger && panels.length === 2) {
        if (!positiveDriveDimensions([...Object.values(hanger.carrierSizeMm), ...Object.values(hanger.connectorSizeMm)]) || !Number.isFinite(hanger.aboveOpeningMm) || !Number.isFinite(hanger.depthOffsetMm)) issue('invalid-door-shape', id, 'hangers')
        else {
          const boxes: ComponentBox[] = [], cylinders: DoorCylinder[] = []
          panels.forEach((_, i) => {
            const x = (i === 0 ? -1 : 1) * width / 4, carrierCenter = p(x, height + mm(hanger.aboveOpeningMm), mm(hanger.depthOffsetMm))
            boxes.push(b(`carrier-${i}`, carrierCenter, toDriveSize(hanger.carrierSizeMm), 'doorFrame'),
              b(`hanger-connector-${i}`, p(x, height + mm(hanger.connectorSizeMm.heightMm) / 2, mm(assembly.panelDepthOffsetsMm[i])), toDriveSize(hanger.connectorSizeMm), 'doorFrame'))
            hanger.rollers.forEach((roller) => { const normalized = cylinder(roller, `hanger-${i}`, 'doorFrame', carrierCenter); if (normalized) cylinders.push({ ...normalized, source: assembly.source }) })
          })
          if (!track || !connected([...boxes.map(componentBoxBounds), ...cylinders.map((c) => c.bounds)], combine(panels.map((panel) => componentBoxBounds(panel.box)))) ||
            cylinders.some((c) => !touches(c.bounds, track!.bounds))) issue('unmounted-door-component', id, 'hangers')
          else hangers = g(boxes, cylinders)
        }
      }
      const guide = assembly.bottomGuide
      if (guide && panels.length === 2) {
        if (!positiveDriveDimensions(Object.values(guide.sizeMm)) || guide.depthOffsetsMm.length !== 2 || guide.depthOffsetsMm.some((v) => !Number.isFinite(v))) issue('invalid-door-shape', id, 'guides')
        else {
          const boxes = panels.map((_, i) => b(`bottom-guide-${i}`, p((i === 0 ? -1 : 1) * width / 4, -mm(guide.sizeMm.heightMm) / 2, mm(guide.depthOffsetsMm[i])), toDriveSize(guide.sizeMm), 'doorFrame'))
          const fits = assembly.sill && sill && boxes.every((_, i) => assembly.sill!.grooves.some((slot) =>
            Math.abs(mm(guide.depthOffsetsMm[i]) - mm(assembly.sill!.depthOffsetMm) - mm(slot.depthOffsetMm)) + mm(guide.sizeMm.depthMm) / 2 <= mm(slot.widthMm) / 2 && guide.sizeMm.heightMm <= slot.depthMm))
          if (!fits || boxes.some((guideBox, i) => !touches(componentBoxBounds(guideBox), componentBoxBounds(panels[i].box)))) issue('invalid-door-sill', id, 'guides')
          else guides = g(boxes)
        }
      }
    }
    const parts = [frame, sill, track, hangers, guides].filter((part): part is DoorPartGroup => !!part)
    return { id, role, side, source, reference, origin, rotationY, openingWidth: width, openingHeight: height,
      openingType: assembly?.openingType, outline, panels, frame, sill, track, hangers, guides,
      bounds: combine([createMechanicalBounds(outline), ...parts.map((part) => part.bounds), ...panels.map((panel) => componentBoxBounds(panel.box))]) }
  }

  function attachments(base: DoorEntranceModel, operatorData?: DoorOperatorData, couplingData?: DoorCouplingData, interlockData?: DoorInterlockData): DoorEntranceModel {
    const at = (local: MechanicalPoint) => transformDrivePoint(local, base.origin, base.rotationY)
    function parts(record: DoorCouplingData | DoorInterlockData | DoorOperatorData, material: MechanicalMaterialRole, offset = p(0, 0, 0)): DoorPartGroup {
      const boxes: ComponentBox[] = [], cylinders: DoorCylinder[] = []
      const records = 'housing' in record ? [{ ...record.housing, id: 'housing' }, ...record.parts] : record.boxes
      records.forEach((part) => {
        if (!positiveDriveDimensions(Object.values(part.sizeMm)) || !finite(toDrivePoint(part.centerMm))) { issue('invalid-door-shape', base.id, part.id); return }
        const center = at(p(...toDrivePoint(part.centerMm).map((v, i) => v + offset[i]) as [number, number, number]))
        boxes.push({ id: `${base.id}-${material}-${part.id}`, source: record.source, material, center, size: toDriveSize(part.sizeMm), rotationY: base.rotationY })
      })
      record.cylinders.forEach((c) => {
        const normalized = normalizeCylinder(c, `${base.id}-${material}-${c.id}`, record.source, material, base.origin, base.rotationY, offset)
        if (!normalized) issue('invalid-door-shape', base.id, c.id)
        else cylinders.push(normalized)
      })
      return { source: record.source, reference: record.reference, boxes, cylinders, bounds: groupBounds(boxes, cylinders) }
    }
    const bounds = (group: DoorPartGroup) => [...group.boxes.map(componentBoxBounds), ...group.cylinders.map((c) => c.bounds)]
    let operator: DoorOperatorModel | undefined, coupling: DoorCouplingModel | undefined, interlock: DoorInterlockModel | undefined
    if (operatorData) {
      const count = issues.length, offset = p(mm(operatorData.offsetXMm), base.openingHeight + mm(operatorData.aboveOpeningMm), mm(operatorData.depthOffsetMm))
      const group = parts(operatorData, 'doorOperator', offset)
      const transform = { center: at(offset), rotationY: base.rotationY }
      const pulleys = operatorData.pulleys.flatMap((wheel) => {
        const center = transformDrivePoint(toDrivePoint(wheel.originMm), transform.center, transform.rotationY)
        // The wheel schema is millimetre-based; construct in its local metre space then transform the normalized output.
        const local = createSheaveModel({ ...wheel, role: 'door-operator' })
        if (!local) { issue('invalid-door-operator', base.id, wheel.id); return [] }
        const rotationY = transform.rotationY + local.rotationY
        return [{ ...local, center, rotationY, axis: p(Math.sin(rotationY), 0, Math.cos(rotationY)),
          bounds: combine([driveBoxBounds(center, p(local.diameter, local.diameter, local.width), rotationY), driveBoxBounds(center, p(local.hubDiameter, local.hubDiameter, local.hubWidth), rotationY)]) }]
      })
      if (!finite(offset) || [group.bounds, ...pulleys.map((wheel) => wheel.bounds)].some((b) => b.min[1] < base.origin[1] + base.openingHeight) || !base.frame ||
        !connected([...bounds(group), ...pulleys.map((wheel) => wheel.bounds)], base.frame.bounds) || new Set(pulleys.map((wheel) => wheel.id)).size !== pulleys.length) issue('invalid-door-operator', base.id, 'operator.mount')
      let drivePath: DoorOperatorModel['drivePath']
      const path = operatorData.drivePath
      if (path) {
        const pieces: { start: MechanicalPoint; end: MechanicalPoint; arc?: Extract<CableSegment, { kind: 'arc' }>; entry?: MechanicalPoint; exit?: MechanicalPoint }[] = []
        if (!positiveDriveDimensions([path.diameterMm])) issue('invalid-door-drive-path', base.id, 'operator.drivePath')
        else for (const node of path.route) {
          if (node.kind === 'point') {
            const point = transformDrivePoint(toDrivePoint(node.positionMm), transform.center, transform.rotationY)
            if (!finite(point)) issue('invalid-door-drive-path', base.id, 'operator.drivePath')
            pieces.push({ start: point, end: point })
          } else {
            const wheel = pulleys.find((wheel) => wheel.id === node.wheelId), sweep = node.exitAngleRad - node.entryAngleRad, diameter = mm(path.diameterMm)
            if (!wheel || wheel.grooveOffsets.length !== 1 || !wheel.grooveWidth || diameter >= wheel.grooveWidth || !Number.isFinite(sweep) || Math.abs(sweep) < GEOMETRY_EPSILON || Math.abs(sweep) > 2 * Math.PI) { issue('invalid-door-drive-path', base.id, 'operator.drivePath'); continue }
            const arc: Extract<CableSegment, { kind: 'arc' }> = { kind: 'arc', sheaveId: wheel.id, center: wheel.center, rotationY: wheel.rotationY, radius: metres(wheel.diameter / 2 - wheel.grooveDepth! + diameter / 2), axialOffset: wheel.grooveOffsets[0], entryAngle: node.entryAngleRad, exitAngle: node.exitAngleRad }
            pieces.push({ start: sheaveContactPoint(wheel, node.entryAngleRad, arc.axialOffset, diameter), end: sheaveContactPoint(wheel, node.exitAngleRad, arc.axialOffset, diameter), arc,
              entry: sheaveContactTangent(wheel, node.entryAngleRad, Math.sign(sweep)), exit: sheaveContactTangent(wheel, node.exitAngleRad, Math.sign(sweep)) })
          }
        }
        const segments: CableSegment[] = []
        pieces.forEach((piece, i) => {
          const next = pieces[(i + 1) % pieces.length], previous = pieces[(i + pieces.length - 1) % pieces.length]
          const direction = p(...next.start.map((v, j) => v - piece.end[j]) as [number, number, number]), length = Math.hypot(...direction)
          const aligned = (a: MechanicalPoint) => length > 0 && a.reduce((sum, v, j) => sum + v * direction[j], 0) / (Math.hypot(...a) * length) > 1 - GEOMETRY_EPSILON
          if (length < GEOMETRY_EPSILON || (piece.exit && !aligned(piece.exit)) || (next.entry && !aligned(next.entry)) ||
            (!piece.arc && !aligned(p(...piece.start.map((v, j) => v - previous.end[j]) as [number, number, number])))) issue('invalid-door-drive-path', base.id, 'operator.drivePath')
          if (piece.arc) segments.push(piece.arc)
          segments.push({ kind: 'line', start: piece.end, end: next.start })
        })
        if (issues.length === count && segments.length) drivePath = { source: path.source, reference: path.reference, diameter: mm(path.diameterMm), closed: true, segments }
      }
      if (issues.length === count) operator = { ...group, entranceId: base.id, transform, pulleys, drivePath,
        bounds: combine([group.bounds, ...pulleys.map((wheel) => wheel.bounds)]) }
    }
    if (couplingData) {
      const count = issues.length, group = parts(couplingData, 'doorCoupling'), panel = base.panels[couplingData.panelIndex], interfacePoint = at(toDrivePoint(couplingData.interfacePointMm))
      if (!panel || !finite(interfacePoint) || !contained(interfacePoint, group.bounds) || !connected(bounds(group), componentBoxBounds(panel.box))) issue('invalid-door-coupling', base.id, 'coupling')
      if (issues.length === count) coupling = { ...group, entranceId: base.id, attachment: base.role, panelId: panel.id, interfacePoint }
    }
    if (interlockData) {
      const count = issues.length, offset = p(mm(interlockData.offsetXMm), base.openingHeight + mm(interlockData.aboveOpeningMm), mm(interlockData.depthOffsetMm))
      const group = parts(interlockData, 'doorInterlock', offset)
      if (!base.levelId || !finite(offset) || !base.frame || !connected(bounds(group), base.frame.bounds)) issue('invalid-door-interlock', base.id, 'interlock')
      if (issues.length === count) interlock = { ...group, entranceId: base.id, levelId: base.levelId!, transform: { center: at(offset), rotationY: base.rotationY } }
    }
    return { ...base, operator, coupling, interlock, bounds: combine([base.bounds, ...[operator, coupling, interlock].flatMap((part) => part ? [part.bounds] : [])]) }
  }

  const enabledSides = new Set<PassengerEntranceSide>(installation.cabin
    ? ['front', ...(installation.cabin.throughCar === true ? ['rear'] as const : [])]
    : [])
  const sides = new Set<PassengerEntranceSide>()
  for (const record of data?.cabin ?? []) {
    if (sides.has(record.side)) issue('duplicate-door-identity', record.id, 'side')
    sides.add(record.side)
    if (enabledSides.has(record.side) && !installation.cabin?.entrances.some((entry) => entry.id === record.id)) {
      issue('missing-door-reference', record.id, 'entrance')
    }
  }
  for (const opening of installation.cabin?.entrances ?? []) {
    const record = data?.cabin?.find((entry) => entry.id === opening.id), c = installation.cabin!
    if (opening.opening.width / 2 + Math.abs(opening.centerX) > c.width / 2) {
      issue('door-width-exceeds-cabin-entrance', opening.id, 'opening.width')
    }
    if (opening.opening.height > c.height) issue('door-height-exceeds-cabin-entrance', opening.id, 'opening.height')
    const base = entrance(opening.id, 'cabin', opening.side, p(opening.centerX, c.bottomY, (opening.side === 'front' ? 1 : -1) * c.depth / 2), opening.opening.width, opening.opening.height,
      record?.source ?? 'planning', record?.reference, record?.assembly)
    if (base) cabin.push(attachments(base, record?.operator, record?.coupling))
  }
  for (const series of data?.landings ?? []) {
    const referencedActiveEntrance = cabin.find((entry) => entry.id === series.cabinEntranceId)
    if (referencedActiveEntrance && referencedActiveEntrance.side !== series.side) {
      issue('entrance-axis-mismatch', series.id, 'side')
      continue
    }
    if (!enabledSides.has(series.side)) continue
    const car = cabin.find((entry) => entry.id === series.cabinEntranceId)
    if (!car) { issue('missing-door-reference', series.id, 'cabinEntranceId'); continue }
    if (car.side !== series.side) { issue('entrance-axis-mismatch', series.id, 'side'); continue }
    if (installation.levels.length === 0) missingData.push(`doors.${series.id}.levels`)
    const overrideIds = new Set<string>()
    for (const override of series.overrides ?? []) {
      if (overrideIds.has(override.levelId) || !installation.levels.some((level) => level.id === override.levelId)) issue('invalid-door-level', series.id, 'overrides')
      overrideIds.add(override.levelId)
    }
    for (const level of installation.levels) {
      const override = series.overrides?.find((entry) => entry.levelId === level.id), separation = override?.separationMm ?? series.separationMm
      if (!positiveDriveDimensions([separation]) || !Number.isFinite(level.elevationY)) { issue('invalid-door-level', series.id, level.id); continue }
      const opening = override?.opening ?? series.opening, origin = p(car.origin[0], level.elevationY, car.origin[2] + (series.side === 'front' ? 1 : -1) * mm(separation))
      const base = entrance(`${series.id}-${level.id}`, 'landing', series.side, origin,
        opening ? mm(opening.widthMm) : car.openingWidth, opening ? mm(opening.heightMm) : car.openingHeight,
        series.source, series.reference, override?.assembly ?? series.assembly)
      if (!base) continue
      const landing = attachments({ ...base, levelId: level.id, cabinEntranceId: car.id }, undefined, override?.coupling ?? series.coupling, override?.interlock ?? series.interlock)
      landings.push(landing)
      const shiftY = level.elevationY - car.origin[1], predicted = p(car.origin[0], level.elevationY, car.origin[2])
      const direction = series.side === 'front' ? 1 : -1
      const sillSeparation = car.sill && landing.sill ? metres(direction === 1 ? landing.sill.bounds.min[2] - car.sill.bounds.max[2] : car.sill.bounds.min[2] - landing.sill.bounds.max[2]) : undefined
      const carPoint = car.coupling ? p(car.coupling.interfacePoint[0], car.coupling.interfacePoint[1] + shiftY, car.coupling.interfacePoint[2]) : undefined
      relationships.push({ cabinEntranceId: car.id, landingEntranceId: landing.id, levelId: level.id, cabinAtLevelOrigin: predicted,
        entranceAxesCorrespond: nearDriveValue(car.origin[0], landing.origin[0]) && nearDriveValue(car.rotationY, landing.rotationY), sillSeparation,
        interfacePointsCoincide: carPoint && landing.coupling ? driveDistance(carPoint, landing.coupling.interfacePoint) < GEOMETRY_EPSILON : undefined })
    }
  }
  const models = [...cabin, ...landings]
  return { cabin, landings, relationships, bounds: models.length ? combine(models.map((entry) => entry.bounds)) : undefined,
    missingData, validation: { state: issues.length ? 'invalid' : missingData.length ? 'incomplete' : 'valid', issues } }
}

/** Inspection does not translate the actual cabin. Higher stops frame their own fixed landing entrance. */
export function getDoorInspection(model: PassengerDoorSystemModel, levels: readonly PassengerLandingLevelModel[], requestedLevelId?: string, requestedSide: PassengerEntranceSide = 'front'): DoorInspection {
  const level = levels.find((entry) => entry.id === requestedLevelId) ?? levels[0]
  const side = model.cabin.some((entry) => entry.side === requestedSide) ? requestedSide : model.cabin[0]?.side ?? requestedSide
  const landing = model.landings.find((entry) => entry.levelId === level?.id && entry.side === side)
  const cabin = model.cabin.find((entry) => entry.side === side), cabinAtLevel = !!cabin && !!level && nearDriveValue(cabin.origin[1], level.elevationY)
  const contexts = [landing?.bounds, ...(!level || cabinAtLevel ? [cabin?.bounds] : [])].filter((entry): entry is MechanicalBounds => !!entry)
  return { level, side, landing, cabin, cabinAtLevel, bounds: contexts.length ? combine(contexts) : undefined }
}
