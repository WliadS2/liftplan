import { metres, millimetresToMetres, type Millimetres } from '../engineering'
import type { PassengerInstallationModel } from '../three/geometry/passenger/passenger-installation-model'
import type { PassengerMechanicalLayout } from '../three/geometry/passenger/mechanical/passenger-mechanical-layout'
import { componentBoxBounds, type PassengerMechanicalComponentModel } from '../three/geometry/passenger/mechanical/mechanical-component-model'
import type { TractionDriveModel } from '../three/geometry/passenger/mechanical/traction-drive-model'
import type { PassengerSafetyModel } from '../three/geometry/passenger/mechanical/passenger-safety-model'
import type { PassengerDoorSystemModel } from '../three/geometry/passenger/doors/passenger-door-model'
import { createInitialSimulationState, createSimulationPose, validateSimulationPose,
  type PassengerSimulationModel, type SimulationIssue, type VisualizationTiming } from './passenger-simulation'

/** Explicit visualization setup, supplied separately from the planning project. */
export interface PassengerVisualizationData {
  readonly source: 'demo' | 'visualization'
  readonly initialLevelIndex: number
  readonly counterweightInitialCenter: { readonly anchor: 'highest-landing'; readonly offsetMm: Millimetres }
  readonly timing: VisualizationTiming
}
export interface PassengerSimulationInputs {
  readonly installation: PassengerInstallationModel
  readonly layout: PassengerMechanicalLayout
  readonly components: PassengerMechanicalComponentModel
  readonly drive: TractionDriveModel
  readonly safety: PassengerSafetyModel
  readonly doors: PassengerDoorSystemModel
}
export type SimulationModelResult = { readonly status: 'available'; readonly model: PassengerSimulationModel }
  | { readonly status: 'unavailable' | 'invalid'; readonly issues: readonly SimulationIssue[] }

/** First motion contract supports explicit vertical 1:1 suspension with a single fixed traction wrap. */
export function createPassengerSimulationModel(inputs: PassengerSimulationInputs, data?: PassengerVisualizationData): SimulationModelResult {
  if (!data) return { status: 'unavailable', issues: [{ code: 'unavailable-data', path: 'visualization' }] }
  const { installation: i, layout, components: c, drive: d, safety: s, doors } = inputs
  const initial = i.levels[data.initialLevelIndex], region = i.vertical.travelRegion, shaft = i.shaft?.verticalExtent
  const traction = d.sheaves.find((sheave) => sheave.role === 'traction'), suspension = d.suspension
  if (!initial || !region || !shaft || !i.cabin || !layout.counterweight || !c.carSling || !c.counterweightFrame ||
    !traction || !suspension || !s.governor || !s.tension || !s.governorRope || !s.linkage || !doors.cabin.length || i.levels.length < 2) {
    return { status: 'unavailable', issues: [{ code: 'unavailable-data', path: 'installation' }] }
  }
  const issues: SimulationIssue[] = []
  if ([layout.validation, d.validation, s.validation, doors.validation].some((validation) => validation.state === 'invalid') || c.issues.length) {
    issues.push({ code: 'unavailable-data', path: 'invalid-layout' })
  }
  if ([data.timing.doorOpeningSeconds, data.timing.doorClosingSeconds, data.timing.dwellSeconds,
    data.timing.travelSeconds, data.timing.arrivalSeconds].some((value) => !Number.isFinite(value) || value <= 0)) issues.push({ code: 'invalid-timing', path: 'timing' })
  if (i.levels.some((level, index) => !Number.isFinite(level.elevationY) || (index > 0 && level.elevationY <= i.levels[index - 1].elevationY))) issues.push({ code: 'invalid-level', path: 'levels' })
  if (suspension.ratio !== '1:1' || suspension.ropes.some((rope) => rope.segments.length !== 3 || rope.segments[0].kind !== 'line' ||
    rope.segments[1].kind !== 'arc' || rope.segments[1].sheaveId !== traction.id || rope.segments[2].kind !== 'line')) {
    return { status: 'invalid', issues: [...issues, { code: 'unsupported-suspension', path: 'suspension' }] }
  }
  const referenceCabinY = i.cabin.bottomY, referenceCounterweightY = layout.counterweight.center[1]
  const initialCounterweightY = metres(i.vertical.highestLandingY! + millimetresToMetres(data.counterweightInitialCenter.offsetMm))
  const carBounds = [c.carSling.bounds, ...c.carGuideShoes.flatMap((shoe) => shoe.boxes.map(componentBoxBounds)),
    ...s.gears.map((gear) => gear.bounds), s.linkage.bounds, ...doors.cabin.map((entry) => entry.bounds),
    ...d.hitches.filter((hitch) => hitch.attachment === 'car').map((hitch) => hitch.bounds)]
  const cwBounds = [c.counterweightFrame.bounds, ...c.counterweightGuideShoes.flatMap((shoe) => shoe.boxes.map(componentBoxBounds)),
    ...d.hitches.filter((hitch) => hitch.attachment === 'counterweight').map((hitch) => hitch.bounds)]
  const carMinOffset = Math.min(...carBounds.map((bounds) => bounds.min[1])) - referenceCabinY
  const carMaxOffset = Math.max(...carBounds.map((bounds) => bounds.max[1])) - referenceCabinY
  const cwMinOffset = Math.min(...cwBounds.map((bounds) => bounds.min[1])) - referenceCounterweightY
  const cwMaxOffset = Math.max(...cwBounds.map((bounds) => bounds.max[1])) - referenceCounterweightY
  const cwEnvelope = { minY: metres(shaft.bottomY - cwMinOffset), maxY: metres(shaft.topY - cwMaxOffset) }
  if (region.bottomY + carMinOffset < shaft.bottomY || region.topY + carMaxOffset > shaft.topY) issues.push({ code: 'outside-envelope', path: 'cabinAssembly' })
  if (doors.cabin.some((entry) => entry.panels.length !== 2) || i.levels.some((level) => doors.cabin.some((entry) =>
    !doors.landings.some((landing) => landing.levelId === level.id && landing.cabinEntranceId === entry.id && landing.panels.length === 2)))) {
    issues.push({ code: 'unavailable-data', path: 'doors' })
  }
  const ropes = suspension.ropes.map((rope) => {
    const start = d.hitches.find((hitch) => hitch.id === rope.startHitchId)!, end = d.hitches.find((hitch) => hitch.id === rope.endHitchId)!
    if (start?.attachment !== 'car' || end?.attachment !== 'counterweight') issues.push({ code: 'unsupported-suspension', path: rope.id })
    return { id: rope.id, segments: rope.segments, startAttachment: 'car' as const, endAttachment: 'counterweight' as const }
  })
  const arc = suspension.ropes[0].segments[1]
  if (arc.kind !== 'arc') return { status: 'invalid', issues: [{ code: 'invalid-route', path: 'suspension' }] }
  const model: PassengerSimulationModel = { levels: i.levels, initialLevelId: initial.id, referenceCabinY, referenceCounterweightY,
    initialCounterweightY, cabinEnvelope: { minY: region.bottomY, maxY: region.topY }, counterweightEnvelope: cwEnvelope,
    counterweightTravelFactor: -1, tractionSheaveId: traction.id, tractionContactRadius: arc.radius,
    tractionRotationSign: arc.exitAngle > arc.entryAngle ? 1 : -1, suspensionRopes: ropes,
    governorSegments: s.governorRope.segments, governorLinkagePoint: s.linkage.ropeConnection, timing: data.timing }
  for (const level of i.levels) {
    const pose = createSimulationPose(model, { ...createInitialSimulationState(model), currentLevel: level.id, sourceLevel: level.id, targetLevel: level.id })
    issues.push(...validateSimulationPose(model, pose))
    // Both endpoints must remain below their explicit fixed top contacts; no reversed or invented rope path.
    for (const rope of pose.suspensionRopes) {
      const first = rope.segments[0], last = rope.segments.at(-1)!
      if (first.kind !== 'line' || last.kind !== 'line' || first.start[1] >= first.end[1] || last.end[1] >= last.start[1]) issues.push({ code: 'invalid-route', path: rope.id })
    }
    const movingLinkageY = s.linkage.ropeConnection[1] + pose.cabinOffsetY
    if (movingLinkageY <= s.tension!.wheel.center[1] || movingLinkageY >= s.governor!.wheel.center[1]) issues.push({ code: 'invalid-route', path: 'governor' })
  }
  return issues.length ? { status: 'invalid', issues } : { status: 'available', model }
}
