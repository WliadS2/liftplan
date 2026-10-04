import type { SheaveData } from '../../../../elevator/configuration/traction-drive-data'
import { metres, millimetresToMetres, type Metres } from '../../../../engineering'
import { createMechanicalBounds, type MechanicalBounds, type MechanicalPoint } from './passenger-mechanical-layout'
import { driveBoxBounds, drivePoint, positiveDriveDimensions, toDrivePoint, transformDrivePoint } from './drive-geometry'

export interface SheaveModel {
  readonly id: string
  readonly role: SheaveData['role']
  readonly source: SheaveData['source']
  readonly reference?: string
  readonly center: MechanicalPoint
  readonly rotationY: number
  readonly axis: MechanicalPoint
  readonly diameter: Metres
  readonly width: Metres
  readonly hubDiameter: Metres
  readonly hubWidth: Metres
  readonly shaftDiameter: Metres
  readonly grooveDepth?: Metres
  readonly grooveWidth?: Metres
  readonly grooveOffsets: readonly Metres[]
  // Closed radius/axial section revolved about local +Z by the rendering factory.
  readonly latheProfile: readonly (readonly [Metres, Metres])[]
  readonly bounds: MechanicalBounds
}

export function createSheaveModel(data: SheaveData): SheaveModel | undefined {
  const mm = millimetresToMetres
  const r = mm(data.diameterMm) / 2, w = mm(data.widthMm), hub = mm(data.hubDiameterMm) / 2
  const hw = mm(data.hubWidthMm), shaft = mm(data.shaftDiameterMm) / 2
  if (!positiveDriveDimensions([r, w, hub, hw, shaft]) || !Number.isFinite(data.rotationYRad) ||
    !Object.values(data.originMm).every(Number.isFinite) || shaft >= hub || hub >= r || hw < w) return undefined
  const grooves = data.grooves
  const depth = grooves ? mm(grooves.depthMm) : undefined
  const grooveWidth = grooves ? mm(grooves.widthMm) : undefined
  const offsets: Metres[] = []
  if (grooves) {
    // Allocation guard only; not an engineering maximum.
    if (!Number.isInteger(grooves.count) || grooves.count <= 0 || grooves.count > 64 ||
      !positiveDriveDimensions([grooves.spacingMm, grooves.depthMm, grooves.widthMm]) ||
      grooves.widthMm >= grooves.spacingMm || r - depth! <= hub ||
      (grooves.count - 1) * mm(grooves.spacingMm) + grooveWidth! >= w) return undefined
    for (let i = 0; i < grooves.count; i++) offsets.push(metres((i - (grooves.count - 1) / 2) * mm(grooves.spacingMm)))
  }
  const section: [Metres, Metres][] = []
  const add = (radius: number, axial: number) => {
    if (!section.length || section.at(-1)![0] !== radius || section.at(-1)![1] !== axial) section.push([metres(radius), metres(axial)])
  }
  add(shaft, -hw / 2); add(hub, -hw / 2); add(hub, -w / 2); add(r, -w / 2)
  for (const offset of offsets) {
    add(r, offset - grooveWidth! / 2); add(r - depth!, offset - grooveWidth! / 2)
    add(r - depth!, offset + grooveWidth! / 2); add(r, offset + grooveWidth! / 2)
  }
  add(r, w / 2); add(hub, w / 2); add(hub, hw / 2); add(shaft, hw / 2); add(shaft, -hw / 2)
  const center = toDrivePoint(data.originMm), rotationY = data.rotationYRad
  const radialBounds = driveBoxBounds(center, drivePoint(2 * r, 2 * r, w), rotationY)
  const hubBounds = driveBoxBounds(center, drivePoint(2 * hub, 2 * hub, hw), rotationY)
  return { id: data.id, role: data.role, source: data.source, reference: data.reference, center, rotationY,
    axis: drivePoint(Math.sin(rotationY), 0, Math.cos(rotationY)), diameter: metres(r * 2), width: w,
    hubDiameter: metres(hub * 2), hubWidth: hw, shaftDiameter: metres(shaft * 2),
    grooveDepth: depth, grooveWidth, grooveOffsets: offsets, latheProfile: section,
    bounds: createMechanicalBounds([radialBounds.min, radialBounds.max, hubBounds.min, hubBounds.max]) }
}

export function sheaveContactPoint(sheave: SheaveModel, angle: number, offset: number, ropeDiameter: number): MechanicalPoint {
  const radius = sheave.diameter / 2 - sheave.grooveDepth! + ropeDiameter / 2
  return transformDrivePoint(drivePoint(radius * Math.cos(angle), radius * Math.sin(angle), offset), sheave.center, sheave.rotationY)
}

export function sheaveContactTangent(sheave: SheaveModel, angle: number, direction: number): MechanicalPoint {
  return transformDrivePoint(drivePoint(-Math.sin(angle) * direction, Math.cos(angle) * direction, 0), drivePoint(0, 0, 0), sheave.rotationY)
}
