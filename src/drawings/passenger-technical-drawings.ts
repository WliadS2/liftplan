import { metresToMillimetres, millimetres, type Millimetres } from '../engineering'
import { isLandingSideServed } from '../elevator/configuration/landing-planning'
import type { PassengerGeometryPlanningInput } from '../three/geometry/lift-geometry-planning-input'
import { createPassengerInstallationModel } from '../three/geometry/passenger/passenger-installation-model'
import type { PassengerEntranceSide } from '../three/geometry/passenger/passenger-installation-model'
import { createPassengerMechanicalLayout, type MechanicalBounds } from '../three/geometry/passenger/mechanical/passenger-mechanical-layout'
import {
  componentBoxBounds,
  componentCylinderBounds,
  createPassengerMechanicalComponents,
  type DetailedRail,
} from '../three/geometry/passenger/mechanical/mechanical-component-model'
import { createTractionDriveModel } from '../three/geometry/passenger/mechanical/traction-drive-model'
import { createPassengerSafetyModel } from '../three/geometry/passenger/mechanical/passenger-safety-model'
import { createPassengerDoorSystem, type DoorEntranceModel } from '../three/geometry/passenger/doors/passenger-door-model'
import { validatePassengerSpatialGeometry, type PassengerSpatialValidationResult } from '../collision/passenger-spatial-validation'
import type { PassengerSpatialGeometryInputs } from '../collision/passenger-spatial-envelopes'
import { layoutGoodsDrawingAnnotations } from './goods-drawing-annotation-layout'
import {
  createTechnicalDrawingDocument,
  componentAnnotation,
  drawingPoint as point,
  horizontalDimension,
  verticalDimension,
  technicalDrawingDetail,
  type DrawingRectangle,
  type TechnicalDrawingDocument,
  type TechnicalDrawingPrimitive,
  type TechnicalDrawingScale,
  type TechnicalDrawingStatus,
  type DrawingPolyline,
} from './technical-drawing'

export interface PassengerDrawingContext {
  readonly inputs: PassengerSpatialGeometryInputs
  readonly validation: PassengerSpatialValidationResult
  readonly normalizationStatus: 'partial' | 'complete' | 'invalid'
}

export interface DoorDrawingSelection {
  readonly levelId?: string
  readonly side?: PassengerEntranceSide
}

const mm = (value: number) => metresToMillimetres(value as Parameters<typeof metresToMillimetres>[0])
const rect = (id: string, role: DrawingRectangle['role'], x: number, y: number, width: number, height: number,
  componentId?: string): DrawingRectangle => ({
  id, kind: componentId ? 'component-outline' : 'rectangle', role, layer: 'geometry',
  x: millimetres(x), y: millimetres(y), width: millimetres(width), height: millimetres(height), componentId,
})
const text = (id: string, value: string, x: number, y: number, anchor: 'start' | 'middle' | 'end' = 'middle', size = 105) => ({
  id, kind: 'text' as const, role: 'secondary' as const, layer: 'annotation' as const,
  position: point(x, y), text: value, anchor, sizeMm: millimetres(size),
})
const line = (id: string, role: 'cut' | 'visible' | 'secondary' | 'centerline' | 'hidden' | 'level' | 'section',
  x1: number, y1: number, x2: number, y2: number) => ({
  id, kind: role === 'centerline' ? 'centerline' as const : 'line' as const, role, layer: 'geometry' as const,
  start: point(x1, y1), end: point(x2, y2),
})
const polyline = (id: string, role: DrawingPolyline['role'], points: readonly (readonly [number, number])[],
  closed = false): DrawingPolyline => ({
  id, kind: 'polyline', role, layer: 'geometry', points: points.map(([x, y]) => point(x, y)), closed,
})
const circle = (id: string, role: 'visible' | 'secondary' | 'centerline', x: number, y: number, radius: number) => ({
  id, kind: 'circle' as const, role, layer: 'geometry' as const, center: point(x, y), radius: millimetres(radius),
})

function drawingStatus(context: PassengerDrawingContext, complete: boolean): TechnicalDrawingStatus {
  if (context.validation.status === 'invalid' || context.normalizationStatus === 'invalid') return 'conflict'
  return complete ? 'complete' : 'incomplete'
}

function scaleMetadata(requested: TechnicalDrawingScale) {
  const denominator = requested === 'auto' ? undefined : Number(requested.slice(2)) as 20 | 25 | 50 | 100
  return {
    requested,
    previewMode: requested === 'auto' ? 'automatic-fit' as const : 'fixed-page' as const,
    printAccuracy: false as const,
    denominator,
    detail: technicalDrawingDetail(requested),
  }
}

export function createPassengerDrawingContext(planning: PassengerGeometryPlanningInput): PassengerDrawingContext | undefined {
  const installationResult = createPassengerInstallationModel(planning)
  if (!('model' in installationResult) || !installationResult.model) return undefined
  const installation = installationResult.model
  const layout = createPassengerMechanicalLayout(planning, installation)
  const components = createPassengerMechanicalComponents(planning.mechanical.components, layout)
  const drive = createTractionDriveModel(planning.mechanical.drive, installation, layout, components)
  const safety = createPassengerSafetyModel(planning.mechanical.safety, installation, layout, components, drive.machine)
  const doors = createPassengerDoorSystem(planning.doors, installation)
  const inputs = { planning, installation, layout, components, drive, safety, doors }
  return {
    inputs,
    validation: validatePassengerSpatialGeometry(inputs),
    normalizationStatus: installationResult.status,
  }
}

function railMarker(primitives: TechnicalDrawingPrimitive[], id: string, x: number, y: number) {
  const size = 55
  primitives.push(
    line(`${id}-x`, 'centerline', x - size, y, x + size, y),
    line(`${id}-y`, 'centerline', x, y - size, x, y + size),
  )
}

function planBox(primitives: TechnicalDrawingPrimitive[], id: string, bounds: MechanicalBounds,
  role: DrawingRectangle['role'] = 'secondary', componentId = id) {
  primitives.push(rect(id, role, Number(mm(bounds.min[0])), Number(mm(-bounds.max[2])),
    Number(mm(bounds.width)), Number(mm(bounds.depth)), componentId))
}

function sectionBox(primitives: TechnicalDrawingPrimitive[], id: string, bounds: MechanicalBounds,
  role: DrawingRectangle['role'] = 'secondary', componentId = id) {
  primitives.push(sectionRectFromBounds(id, bounds, role, componentId))
}

function planRailProfile(primitives: TechnicalDrawingPrimitive[], rail: DetailedRail) {
  const cosine = Math.cos(rail.rotationY), sine = Math.sin(rail.rotationY)
  const points = rail.profile.points.map(([u, v]) => {
    const x = rail.origin[0] + cosine * u + sine * v
    const z = rail.origin[2] - sine * u + cosine * v
    return [Number(mm(x)), Number(mm(-z))] as const
  })
  primitives.push(polyline(`${rail.id}-profile`, 'visible', points, true))
}

function entrancePlanParts(primitives: TechnicalDrawingPrimitive[], entrance: DoorEntranceModel,
  detail: ReturnType<typeof technicalDrawingDetail>, includeMechanics: boolean) {
  for (const panel of entrance.panels) planBox(primitives, panel.id, componentBoxBounds(panel.box), 'visible', panel.id)
  for (const group of [entrance.frame, entrance.sill]) {
    for (const part of group?.boxes ?? []) planBox(primitives, part.id, componentBoxBounds(part), 'secondary', part.id)
  }
  if (detail === 'planning' && includeMechanics) {
    for (const group of [entrance.track, entrance.operator, entrance.hangers, entrance.guides]) {
      for (const part of group?.boxes ?? []) planBox(primitives, part.id, componentBoxBounds(part), 'secondary', part.id)
      for (const part of group?.cylinders ?? []) planBox(primitives, part.id, part.bounds, 'secondary', part.id)
    }
  }
}

function formatElevation(elevationMm: number): string {
  if (Math.abs(elevationMm) < Number.EPSILON) return '±0.000'
  const metresValue = elevationMm / 1000
  return `${metresValue > 0 ? '+' : ''}${metresValue.toFixed(3)}`
}

const PLAN_ANNOTATION = {
  doorDimensionOffsetMm: 280,
  cabinDimensionOffsetMm: 540,
  cabinLabelOffsetMm: 170,
  railLabelOffsetMm: 150,
  counterweightLabelOffsetMm: 150,
} as const

/** Plan projection: world X maps right; world Z maps up by pageY = -Z. */
export function createPassengerPlanDrawing(context: PassengerDrawingContext,
  scale: TechnicalDrawingScale = 'auto', levelId?: string): TechnicalDrawingDocument {
  const { installation, layout, components, doors } = context.inputs
  const selectedLevel = levelId === undefined ? installation.levels[0] : installation.levels.find((entry)=>entry.id===levelId)
  const detail = technicalDrawingDetail(scale)
  const primitives: TechnicalDrawingPrimitive[] = []
  const shaft = installation.shaft
  const cabin = installation.cabin
  if (shaft) {
    const width = Number(mm(shaft.width)), depth = Number(mm(shaft.depth))
    primitives.push(rect('shaft', 'cut', -width / 2, -depth / 2, width, depth, 'shaft'),
      line('shaft-axis-x', 'centerline', -width / 2 - 120, 0, width / 2 + 120, 0),
      line('shaft-axis-z', 'centerline', 0, -depth / 2 - 120, 0, depth / 2 + 120),
      text('shaft-label', 'Schacht', -width / 2 + 120, -depth / 2 + 170, 'start'))
  }
  if (cabin) {
    const width = Number(mm(cabin.width)), depth = Number(mm(cabin.depth))
    primitives.push(rect('cabin', 'visible', -width / 2, -depth / 2, width, depth, 'cabin'),
      line('cabin-axis-x', 'centerline', -width / 2 - 80, 0, width / 2 + 80, 0),
      line('cabin-axis-z', 'centerline', 0, -depth / 2 - 80, 0, depth / 2 + 80))
    primitives.push(...componentAnnotation(
      'cabin-label',
      'Kabine',
      point(width / 2, 0),
      point(width / 2 + PLAN_ANNOTATION.cabinLabelOffsetMm, 120),
      { anchor: 'start' },
    ))
  }
  if (components.carSling && detail === 'planning') {
    components.carSling.boxes.forEach((part) => planBox(primitives, part.id, componentBoxBounds(part)))
  } else if (layout.carFrame) {
    planBox(primitives, 'car-frame', layout.carFrame.bounds, 'secondary', 'car-frame')
  }
  if (detail === 'planning' && components.carRails) {
    components.carRails.forEach((rail) => planRailProfile(primitives, rail))
  } else {
    for (const rail of layout.carRails?.rails ?? []) railMarker(primitives, rail.id, Number(mm(rail.start[0])), Number(mm(-rail.start[2])))
  }
  if (scale === '1:20' || scale === '1:25') {
    components.carGuideShoes.flatMap((shoe) => shoe.boxes)
      .forEach((part) => planBox(primitives, part.id, componentBoxBounds(part)))
  }
  const labelledCarRail = layout.carRails?.rails.at(-1)
  if (labelledCarRail) {
    const railX = Number(mm(labelledCarRail.start[0]))
    const railY = Number(mm(-labelledCarRail.start[2]))
    primitives.push(...componentAnnotation(
      'car-rail-label',
      'Führungsschiene',
      point(railX, railY),
      point(railX + PLAN_ANNOTATION.railLabelOffsetMm, railY - 230),
      { anchor: 'start', sizeMm: millimetres(80) },
    ))
  }
  if (components.counterweightFrame) {
    planBox(primitives, 'counterweight', components.counterweightFrame.bounds, 'visible', 'counterweight')
    components.counterweightFrame.boxes.forEach((part) => planBox(primitives, part.id, componentBoxBounds(part)))
    planBox(primitives, 'counterweight-stack', components.counterweightFrame.stackBounds, 'hidden', 'counterweight-stack')
    const bounds = components.counterweightFrame.bounds
    const x = Number(mm(bounds.center[0])), y = Number(mm(-bounds.min[2]))
    primitives.push(...componentAnnotation('counterweight-label', 'Gegengewicht', point(x, y),
      point(x, y + PLAN_ANNOTATION.counterweightLabelOffsetMm), { anchor: 'middle' }))
  } else if (layout.counterweight) {
    const bounds = layout.counterweight.bounds
    const x = Number(mm(bounds.min[0])), y = Number(mm(-bounds.max[2]))
    const width = Number(mm(bounds.width)), depth = Number(mm(bounds.depth))
    primitives.push(rect('counterweight', 'secondary', x, y, width, depth, 'counterweight'))
    primitives.push(...componentAnnotation(
      'counterweight-label',
      'Gegengewicht',
      point(x + width / 2, y + depth),
      point(x + width / 2, y + depth + PLAN_ANNOTATION.counterweightLabelOffsetMm),
      { anchor: 'middle' },
    ))
  }
  if (detail === 'planning' && components.counterweightRails) {
    components.counterweightRails.forEach((rail) => planRailProfile(primitives, rail))
  } else {
    for (const rail of layout.counterweightRails?.rails ?? []) railMarker(primitives, rail.id, Number(mm(rail.start[0])), Number(mm(-rail.start[2])))
  }
  if (scale === '1:20' || scale === '1:25') {
    components.counterweightGuideShoes.flatMap((shoe) => shoe.boxes)
      .forEach((part) => planBox(primitives, part.id, componentBoxBounds(part)))
  }
  for (const entrance of doors.cabin.filter((entry)=>selectedLevel ? isLandingSideServed(selectedLevel,entry.side) : levelId === undefined)) {
    const x1 = Number(mm(entrance.origin[0] - entrance.openingWidth / 2))
    const x2 = Number(mm(entrance.origin[0] + entrance.openingWidth / 2))
    const y = Number(mm(-entrance.origin[2]))
    primitives.push(line(`${entrance.id}-opening`, 'visible', x1, y, x2, y),
      line(`${entrance.id}-axis`, 'centerline', Number(mm(entrance.origin[0])), y - 360,
        Number(mm(entrance.origin[0])), y + 160))
    entrancePlanParts(primitives, entrance, detail, scale === '1:20' || scale === '1:25')
  }
  for (const entrance of doors.landings.filter((entry) => entry.levelId === selectedLevel?.id)) {
    const x = Number(mm(entrance.origin[0])), y = Number(mm(-entrance.origin[2])), half = Number(mm(entrance.openingWidth / 2))
    primitives.push(line(`${entrance.id}-opening`, 'visible', x-half,y,x+half,y))
    entrancePlanParts(primitives, entrance, detail, scale === '1:20' || scale === '1:25')
  }

  if (shaft) {
    const width = Number(mm(shaft.width)), depth = Number(mm(shaft.depth))
    primitives.push(
      horizontalDimension('shaft-width', 'shaft-width', -width / 2, width / 2, depth / 2, depth / 2 + 300, millimetres(width)),
      verticalDimension('shaft-depth', 'shaft-depth', -depth / 2, depth / 2, width / 2, width / 2 + 300, millimetres(depth)),
    )
  }
  if (cabin) {
    const width = Number(mm(cabin.width)), depth = Number(mm(cabin.depth))
    primitives.push(
      horizontalDimension('cabin-width', 'cabin-width', -width / 2, width / 2, -depth / 2,
        -depth / 2 - PLAN_ANNOTATION.cabinDimensionOffsetMm, millimetres(width)),
      verticalDimension('cabin-depth', 'cabin-depth', -depth / 2, depth / 2, -width / 2, -width / 2 - 300, millimetres(depth)),
    )
  }
  const applicableEntrances = cabin?.entrances.filter((entry)=>selectedLevel ? isLandingSideServed(selectedLevel,entry.side) : levelId === undefined)
  const front = applicableEntrances?.find((entry) => entry.side === 'front') ?? applicableEntrances?.[0]
  if (front) {
    const width = Number(mm(front.opening.width)), center = Number(mm(front.centerX)), y = cabin ? Number(mm(-cabin.depth / 2)) : 0
    primitives.push(horizontalDimension('door-width', 'door-width', center - width / 2, center + width / 2, y,
      y - PLAN_ANNOTATION.doorDimensionOffsetMm, millimetres(width)))
  }
  const complete = !!shaft && !!cabin
  return createTechnicalDrawingDocument({
    id: 'passenger-plan', title: 'Grundriss', view: 'plan', status: drawingStatus(context, complete),
    incompleteMessage: complete ? undefined : 'Für den Grundriss fehlen Schacht- oder Kabinendaten.',
    coordinateSystem: 'X horizontal; Z vertical with page Y = -Z', scale: scaleMetadata(scale), primitives: layoutGoodsDrawingAnnotations(primitives, 100), annotationLayout: 'goods-columns',
  })
}

function sectionRectFromBounds(id: string, bounds: MechanicalBounds, role: DrawingRectangle['role'], componentId?: string) {
  return rect(id, role, Number(mm(bounds.min[0])), Number(mm(-bounds.max[1])),
    Number(mm(bounds.max[0] - bounds.min[0])), Number(mm(bounds.max[1] - bounds.min[1])), componentId)
}

/** Vertical section projection: world X maps right; world Y maps up by pageY = -Y. */
export function createPassengerSectionDrawing(context: PassengerDrawingContext,
  scale: TechnicalDrawingScale = 'auto'): TechnicalDrawingDocument {
  const { installation, layout, components, drive, safety, doors } = context.inputs
  const detail = technicalDrawingDetail(scale)
  const primitives: TechnicalDrawingPrimitive[] = []
  const shaft = installation.shaft
  const extent = shaft?.verticalExtent
  const annotationSize = Math.max(105, extent ? Number(mm(extent.height)) / 55 : 105)
  if (shaft && extent) {
    const width = Number(mm(shaft.width)), bottom = Number(mm(-extent.topY)), height = Number(mm(extent.height))
    primitives.push(rect('shaft-section', 'cut', -width / 2, bottom, width, height, 'shaft'),
      line('shaft-section-axis', 'centerline', 0, bottom - 100, 0, bottom + height + 100))
  }
  const pitBottom = installation.vertical.pitBottomY, lowest = installation.vertical.lowestLandingY
  if (shaft && pitBottom !== undefined && lowest !== undefined) {
    const width = Number(mm(shaft.width))
    primitives.push(rect('pit', 'secondary', -width / 2, Number(mm(-lowest)), width, Number(mm(lowest - pitBottom)), 'pit'),
      text('pit-label', 'Grube', width * 0.2, Number(mm(-(pitBottom + lowest) / 2)), 'middle', annotationSize * 0.6))
  }
  const headroom = installation.vertical.headroomRegion
  if (shaft && headroom) {
    const width = Number(mm(shaft.width))
    primitives.push(rect('headroom', 'secondary', -width / 2, Number(mm(-headroom.topY)), width,
      Number(mm(headroom.topY - headroom.bottomY)), 'headroom'))
    primitives.push(text('headroom-label', 'Schachtkopf', width * 0.2, Number(mm(-(headroom.bottomY + headroom.topY) / 2)), 'middle', annotationSize * 0.6))
  }
  for (const level of installation.levels) {
    const width = shaft ? Number(mm(shaft.width)) : installation.cabin ? Number(mm(installation.cabin.width)) : 2000
    const y = Number(mm(-level.elevationY))
    primitives.push(line(`${level.id}-line`, 'level', -width / 2 - 120, y, width / 2 + 120, y),
      line(`${level.id}-level-tick`, 'level', width / 2 + 120, y, width / 2 + 165, y - 35),
      text(`${level.id}-label`, `${formatElevation(Number(mm(level.elevationY)))} · ${level.label || `Haltestelle ${level.index + 1}`}`,
        width / 2 + 190, y - 45, 'start', annotationSize))
    if (installation.landingAccessConfigured) primitives.push(text(`${level.id}-access`,
      doors.cabin.filter((entry)=>isLandingSideServed(level,entry.side)).map((e)=>e.side==='front'?'Vorne':'Hinten').join(' / '),
      width/2+190,y+100,'start',annotationSize))
  }
  if (installation.cabin) {
    const cabin = installation.cabin, width = Number(mm(cabin.width)), height = Number(mm(cabin.height))
    primitives.push(rect('cabin-section', 'visible', -width / 2, Number(mm(-(cabin.bottomY + cabin.height))), width, height, 'cabin'))
  }
  if (components.carSling && detail === 'planning') {
    components.carSling.boxes.forEach((part) => sectionBox(primitives, part.id, componentBoxBounds(part)))
  } else if (layout.carFrame) {
    sectionBox(primitives, 'car-frame-section', layout.carFrame.bounds, 'secondary', 'car-frame')
  }
  for (const rail of components.carRails ?? []) {
    const x = Number(mm(rail.origin[0]))
    primitives.push(line(`${rail.id}-section`, 'secondary', x, Number(mm(-rail.origin[1])), x,
      Number(mm(-(rail.origin[1] + rail.length)))))
  }
  if (components.counterweightFrame) {
    components.counterweightFrame.boxes.forEach((part) => sectionBox(primitives, part.id, componentBoxBounds(part)))
    sectionBox(primitives, 'counterweight-stack-section', components.counterweightFrame.stackBounds, 'hidden', 'counterweight-stack')
    if (scale === '1:20' || scale === '1:25') {
      components.counterweightFrame.slabs.forEach((part) => sectionBox(primitives, part.id, componentBoxBounds(part), 'secondary', part.id))
    }
  } else if (layout.counterweight) {
    sectionBox(primitives, 'counterweight-section', layout.counterweight.bounds, 'secondary', 'counterweight')
  }
  for (const rail of components.counterweightRails ?? []) {
    const x = Number(mm(rail.origin[0]))
    primitives.push(line(`${rail.id}-section`, 'secondary', x, Number(mm(-rail.origin[1])), x,
      Number(mm(-(rail.origin[1] + rail.length)))))
  }
  const sectionLandings = doors.landings.filter((entry,index,all)=>all.findIndex((other)=>other.levelId===entry.levelId &&
    other.origin[0]===entry.origin[0] && other.openingWidth===entry.openingWidth && other.openingHeight===entry.openingHeight)===index)
  for (const landing of sectionLandings) {
    const width = Number(mm(landing.openingWidth)), height = Number(mm(landing.openingHeight))
    primitives.push(rect(`${landing.id}-opening`, 'visible', Number(mm(landing.origin[0])) - width / 2,
      Number(mm(-(landing.origin[1] + landing.openingHeight))), width, height, landing.id))
  }
  const machineBounds = drive.machine?.bounds ?? layout.machine?.bounds
  if (machineBounds) {
    if (drive.machine && detail === 'planning') {
      sectionBox(primitives, 'machine', machineBounds, 'hidden', 'machine')
      drive.supports.forEach((part) => sectionBox(primitives, part.id, componentBoxBounds(part)))
      drive.machine.boxes.forEach((part) => sectionBox(primitives, part.id, componentBoxBounds(part), 'visible', part.id))
      drive.machine.cylinders.forEach((part) => sectionBox(primitives, part.id, part.bounds, 'visible', part.id))
    } else sectionBox(primitives, 'machine', machineBounds, 'visible', 'machine')
    primitives.push(...componentAnnotation('machine-label', 'Maschine',
      point(Number(mm(machineBounds.center[0])), Number(mm(-machineBounds.center[1]))),
      point(Number(mm(machineBounds.min[0])) - 180, Number(mm(-machineBounds.max[1])) - 120),
      { anchor: 'end', sizeMm: millimetres(annotationSize) }))
  }
  const sheaves = detail === 'planning' ? drive.sheaves : drive.sheaves.slice(0, 1)
  sheaves.forEach((sheave, index) => {
    const x = Number(mm(sheave.center[0])), y = Number(mm(-sheave.center[1])), radius = Number(mm(sheave.diameter / 2))
    primitives.push(circle(`${sheave.id}-section`, 'visible', x, y, radius),
      line(`${sheave.id}-axis`, 'centerline', x - radius - 45, y, x + radius + 45, y))
    if (index === 0 && detail === 'planning') primitives.push(...componentAnnotation('sheave-label', 'Treibscheibe', point(x, y),
      point(x + radius + 170, y + radius + 110), { anchor: 'start', sizeMm: millimetres(annotationSize) }))
  })
  const ropes = drive.suspension?.ropes ?? []
  const projectedRopes = new Set<string>()
  ;(detail === 'planning' ? ropes : ropes.slice(0, 1)).forEach((rope) => {
    const points = rope.points.map((entry) => [Number(mm(entry[0])), Number(mm(-entry[1]))] as const)
    const signature = points.map(([x, y]) => `${x}:${y}`).join('|')
    if (points.length > 1 && !projectedRopes.has(signature)) {
      projectedRopes.add(signature)
      primitives.push(polyline(`${rope.id}-section`, 'hidden', points))
    }
  })
  for (const assembly of [safety.governor, safety.tension]) {
    if (!assembly) continue
    const wheel = assembly.wheel
    const x = Number(mm(wheel.center[0])), y = Number(mm(-wheel.center[1])), radius = Number(mm(wheel.diameter / 2))
    primitives.push(circle(`${wheel.id}-section`, 'secondary', x, y, radius))
    assembly.boxes.forEach((part) => sectionBox(primitives, part.id, componentBoxBounds(part)))
  }
  if (detail === 'planning' && safety.governorRope && safety.governorRope.points.length > 1) {
    primitives.push(polyline('governor-rope-section', 'hidden', safety.governorRope.points.map((entry) =>
      [Number(mm(entry[0])), Number(mm(-entry[1]))] as const), true))
  }
  const bufferBounds = [components.carBuffers, components.counterweightBuffers].flatMap((buffer) => buffer ? [
    ...buffer.boxes.map(componentBoxBounds), ...buffer.cylinders.map(componentCylinderBounds),
  ] : [])
  bufferBounds.forEach((bounds, index) => primitives.push(sectionRectFromBounds(`buffer-${index}`, bounds, 'secondary', `buffer-${index}`)))

  if (extent) {
    const left = shaft ? -Number(mm(shaft.width)) / 2 : -700
    primitives.push(verticalDimension('installation-height', 'installation-height', Number(mm(-extent.topY)), Number(mm(-extent.bottomY)), left, left - 650,
      millimetres(Number(mm(extent.height))), millimetres(annotationSize)))
  }
  if (pitBottom !== undefined && lowest !== undefined) {
    const left = shaft ? -Number(mm(shaft.width)) / 2 : -700
    primitives.push(verticalDimension('pit-depth', 'pit-depth', Number(mm(-lowest)), Number(mm(-pitBottom)), left, left - 360,
      millimetres(Number(mm(lowest - pitBottom))), millimetres(annotationSize)))
  }
  if (headroom) {
    const left = shaft ? -Number(mm(shaft.width)) / 2 : -700
    primitives.push(verticalDimension('headroom-height', 'headroom', Number(mm(-headroom.topY)), Number(mm(-headroom.bottomY)), left, left - 360,
      millimetres(Number(mm(headroom.topY - headroom.bottomY))), millimetres(annotationSize)))
  }
  if (installation.levels.length > 1) {
    const right = shaft ? Number(mm(shaft.width)) / 2 : 700
    installation.levels.slice(1).forEach((level, index) => {
      const previous = installation.levels[index]
      primitives.push(verticalDimension(`storey-${index + 1}`, 'storey-height', Number(mm(-level.elevationY)), Number(mm(-previous.elevationY)),
        right, right + 520, millimetres(Number(mm(level.elevationY - previous.elevationY))), millimetres(annotationSize)))
    })
  }
  const complete = !!extent && installation.levels.length > 0
  return createTechnicalDrawingDocument({
    id: 'passenger-section', title: 'Schnitt', view: 'section', status: drawingStatus(context, complete),
    incompleteMessage: complete ? undefined : 'Für den Schnitt fehlen Schachthöhe oder Haltestellen.',
    coordinateSystem: 'X horizontal; Y vertical with page Y = -Y', scale: scaleMetadata(scale), primitives: layoutGoodsDrawingAnnotations(primitives, 100), annotationLayout: 'goods-columns',
  })
}

function doorLocalX(entrance: DoorEntranceModel, worldX: number) {
  return Number(mm(entrance.side === 'front' ? worldX - entrance.origin[0] : entrance.origin[0] - worldX))
}

function doorPartRect(id: string, entrance: DoorEntranceModel, bounds: MechanicalBounds, role: DrawingRectangle['role']) {
  const a = doorLocalX(entrance, bounds.min[0]), b = doorLocalX(entrance, bounds.max[0])
  return rect(id, role, Math.min(a, b), Number(mm(-(bounds.max[1] - entrance.origin[1]))), Math.abs(b - a),
    Number(mm(bounds.max[1] - bounds.min[1])), id)
}

/** Entrance elevation: local entrance width maps right; world Y maps up by pageY = -Y. */
export function createPassengerDoorElevationDrawing(context: PassengerDrawingContext,
  selection: DoorDrawingSelection = {}, scale: TechnicalDrawingScale = 'auto'): TechnicalDrawingDocument {
  const { installation, doors } = context.inputs
  const detail = technicalDrawingDetail(scale)
  const level = selection.levelId === undefined ? installation.levels[0] : installation.levels.find((entry) => entry.id === selection.levelId)
  const availableSides = [...new Set(doors.cabin.map((entry) => entry.side))]
  const side = selection.side ?? availableSides[0] ?? 'front'
  const landing = doors.landings.find((entry) => entry.levelId === level?.id && entry.side === side)
  const cabin = doors.cabin.find((entry) => entry.side === side)
  const entrance = level && isLandingSideServed(level,side) ? landing ?? cabin : undefined
  const primitives: TechnicalDrawingPrimitive[] = []
  if (entrance) {
    const width = Number(mm(entrance.openingWidth)), height = Number(mm(entrance.openingHeight))
    primitives.push(rect('door-opening', 'cut', -width / 2, -height, width, height, entrance.id),
      line('door-axis', 'centerline', 0, -height - 180, 0, 140),
      line('door-threshold-reference', 'level', -width / 2 - 240, 0, width / 2 + 240, 0))
    for (const panel of entrance.panels) {
      const center = doorLocalX(entrance, panel.closed.center[0]), panelWidth = Number(mm(panel.width)), panelHeight = Number(mm(panel.height))
      primitives.push(rect(panel.id, 'visible', center - panelWidth / 2, -panelHeight, panelWidth, panelHeight, panel.id))
    }
    const groups = detail === 'simplified'
      ? [entrance.frame, entrance.sill]
      : [entrance.frame, entrance.sill, entrance.track, entrance.operator,
          ...(scale === '1:20' || scale === '1:25' ? [entrance.hangers, entrance.guides] : [])]
    for (const group of groups) {
      for (const part of group?.boxes ?? []) primitives.push(doorPartRect(part.id, entrance, componentBoxBounds(part), 'secondary'))
      for (const part of group?.cylinders ?? []) primitives.push(doorPartRect(part.id, entrance, part.bounds, 'secondary'))
    }
    primitives.push(
      horizontalDimension('door-elevation-width', 'door-width', -width / 2, width / 2, 0, 300, millimetres(width)),
      verticalDimension('door-elevation-height', 'door-height', -height, 0, width / 2, width / 2 + 300, millimetres(height)),
      text('door-title', `${landing ? 'Schachttür' : 'Kabinentür'} · ${level ? level.label || `Haltestelle ${level.index + 1}` : 'Haltestelle nicht gewählt'} · ${side === 'front' ? 'Vorne' : 'Hinten'}`,
        0, -height - 260),
    )
  }
  const complete = !!entrance && !!level
  return createTechnicalDrawingDocument({
    id: `passenger-door-${level?.id ?? 'none'}-${side}`, title: 'Türansicht', view: 'door-elevation',
    status: drawingStatus(context, complete),
    incompleteMessage: complete ? undefined : 'Für diese Türansicht fehlen explizite Zugangs- oder Haltestellendaten.',
    coordinateSystem: 'Entrance-local width horizontal; Y vertical with page Y = -Y', scale: scaleMetadata(scale), primitives: layoutGoodsDrawingAnnotations(primitives, 100), annotationLayout: 'goods-columns',
  })
}

export function getAvailableDoorSides(context: PassengerDrawingContext): readonly PassengerEntranceSide[] {
  return [...new Set(context.inputs.doors.cabin.map((entry) => entry.side))]
}

export function findDimensions(document: TechnicalDrawingDocument, semantic: string): readonly Millimetres[] {
  return document.primitives.flatMap((primitive) => primitive.kind === 'dimension' && primitive.semantic === semantic
    ? [primitive.valueMm] : [])
}
