import { metres, millimetresToMetres, type Millimetres } from '../engineering'
import type { PassengerInstallationModel } from '../three/geometry/passenger/passenger-installation-model'
import type { PassengerGeometryPlanningInput } from '../three/geometry/lift-geometry-planning-input'
import type { PassengerMechanicalLayout, MechanicalBounds } from '../three/geometry/passenger/mechanical/passenger-mechanical-layout'
import { componentBoxBounds, type PassengerMechanicalComponentModel } from '../three/geometry/passenger/mechanical/mechanical-component-model'
import type { TractionDriveModel } from '../three/geometry/passenger/mechanical/traction-drive-model'
import type { PassengerSafetyModel } from '../three/geometry/passenger/mechanical/passenger-safety-model'
import type { PassengerDoorSystemModel } from '../three/geometry/passenger/doors/passenger-door-model'
import {
  createInitialSimulationState,
  createSimulationPose,
  validateSimulationPose,
  type PassengerSimulationCapabilities,
  type PassengerSimulationCapabilityName,
  type PassengerSimulationModel,
  type SimulationIssue,
  type SimulationRope,
  type VisualizationTiming,
} from './passenger-simulation'
import { PASSENGER_VISUALIZATION_TIMING } from './passenger-visualization-profile'
import { validatePassengerSpatialGeometry } from '../collision/passenger-spatial-validation'

/** Optional visualization setup, supplied separately from technical project data. */
export interface PassengerVisualizationData {
  readonly source: 'demo' | 'visualization'
  readonly initialLevelIndex?: number
  readonly counterweightInitialCenter?: {
    readonly anchor: 'highest-landing'
    readonly offsetMm: Millimetres
  }
  readonly timing?: VisualizationTiming
}

export interface PassengerSimulationInputs {
  readonly planning: PassengerGeometryPlanningInput
  readonly installation: PassengerInstallationModel
  readonly layout: PassengerMechanicalLayout
  readonly components: PassengerMechanicalComponentModel
  readonly drive: TractionDriveModel
  readonly safety: PassengerSafetyModel
  readonly doors: PassengerDoorSystemModel
}

export type SimulationModelResult = {
  readonly status: 'available'
  readonly availability: 'complete' | 'partial'
  readonly model: PassengerSimulationModel
  readonly issues: readonly SimulationIssue[]
} | {
  readonly status: 'unavailable' | 'invalid'
  readonly issues: readonly SimulationIssue[]
}

const capability = (available: boolean, path: string): PassengerSimulationCapabilities[PassengerSimulationCapabilityName] => ({
  available,
  issues: available ? [] : [{ code: 'unavailable-data', path }],
})

function validTiming(timing: VisualizationTiming): boolean {
  return [timing.doorOpeningSeconds, timing.doorClosingSeconds, timing.dwellSeconds,
    timing.travelSeconds, timing.arrivalSeconds].every((value) => Number.isFinite(value) && value > 0)
}

function boundsOffsets(bounds: readonly MechanicalBounds[], referenceY: number) {
  return {
    min: Math.min(...bounds.map((entry) => entry.min[1])) - referenceY,
    max: Math.max(...bounds.map((entry) => entry.max[1])) - referenceY,
  }
}

function supportedSuspension(inputs: PassengerSimulationInputs) {
  const traction = inputs.drive.sheaves.find((sheave) => sheave.role === 'traction')
  const suspension = inputs.drive.suspension
  if (!traction || !suspension || suspension.ratio !== '1:1' || suspension.ropes.length === 0) return undefined
  if (suspension.ropes.some((rope) => rope.segments.length !== 3 || rope.segments[0].kind !== 'line' ||
    rope.segments[1].kind !== 'arc' || rope.segments[1].sheaveId !== traction.id || rope.segments[2].kind !== 'line')) return undefined
  const ropes: SimulationRope[] = []
  for (const rope of suspension.ropes) {
    const start = inputs.drive.hitches.find((hitch) => hitch.id === rope.startHitchId)
    const end = inputs.drive.hitches.find((hitch) => hitch.id === rope.endHitchId)
    if (start?.attachment !== 'car' || end?.attachment !== 'counterweight') return undefined
    ropes.push({ id: rope.id, segments: rope.segments, startAttachment: 'car', endAttachment: 'counterweight' })
  }
  const arc = suspension.ropes[0].segments[1]
  if (arc.kind !== 'arc') return undefined
  return { traction, ropes, arc }
}

function doorsCanMove(inputs: PassengerSimulationInputs): boolean {
  const { doors, installation } = inputs
  if (doors.validation.state === 'invalid' || doors.cabin.length === 0) return false
  return doors.cabin.every((entry) => entry.panels.length > 0 && installation.levels.every((level) =>
    doors.landings.some((landing) => landing.levelId === level.id &&
      landing.cabinEntranceId === entry.id && landing.panels.length > 0)))
}

/**
 * Builds the shared visual-motion model. Only cabin travel is fundamental;
 * mechanical, drive, rope, governor, and door animations are independent capabilities.
 */
export function createPassengerSimulationModel(
  inputs: PassengerSimulationInputs,
  data?: PassengerVisualizationData,
): SimulationModelResult {
  const { installation, layout, components, drive, safety } = inputs
  const timing = data?.timing ?? PASSENGER_VISUALIZATION_TIMING
  if (!validTiming(timing)) return { status: 'invalid', issues: [{ code: 'invalid-timing', path: 'visualization.timing' }] }

  const initialIndex = data?.initialLevelIndex ?? installation.vertical.cabinLevelIndex ?? 0
  const initial = installation.levels[initialIndex]
  const region = installation.vertical.travelRegion
  const basicIssues: SimulationIssue[] = []
  if (installation.levels.length < 2) basicIssues.push({ code: 'unavailable-data', path: 'levels' })
  if (!initial) basicIssues.push({ code: 'unavailable-data', path: 'currentLevel' })
  if (!installation.cabin) basicIssues.push({ code: 'unavailable-data', path: 'cabin' })
  if (!region) basicIssues.push({ code: 'unavailable-data', path: 'cabin.travelEnvelope' })
  if (basicIssues.length) return { status: 'unavailable', issues: basicIssues }
  if (installation.levels.some((level, index) => !Number.isFinite(level.elevationY) ||
    (index > 0 && level.elevationY <= installation.levels[index - 1].elevationY))) {
    return { status: 'invalid', issues: [{ code: 'invalid-level', path: 'levels' }] }
  }

  const cabin = installation.cabin!
  const shaft = installation.shaft?.verticalExtent
  if (shaft && installation.levels.some((level) => level.elevationY < shaft.bottomY || level.elevationY + cabin.height > shaft.topY)) {
    return { status: 'invalid', issues: [{ code: 'outside-envelope', path: 'cabin.travelEnvelope' }] }
  }

  const suspension = supportedSuspension(inputs)
  const counterweightLayout = layout.counterweight
  const counterweightReferenceY = counterweightLayout?.center[1]
  const initialCounterweightY = counterweightReferenceY === undefined ? undefined
    : data?.counterweightInitialCenter
      ? metres(installation.vertical.highestLandingY! + millimetresToMetres(data.counterweightInitialCenter.offsetMm))
      : counterweightReferenceY
  const counterweightBounds = counterweightLayout ? [
    counterweightLayout.bounds,
    ...(components.counterweightFrame ? [components.counterweightFrame.bounds] : []),
    ...components.counterweightGuideShoes.flatMap((shoe) => shoe.boxes.map(componentBoxBounds)),
    ...drive.hitches.filter((hitch) => hitch.attachment === 'counterweight').map((hitch) => hitch.bounds),
  ] : []
  let counterweight = undefined as PassengerSimulationModel['counterweight']
  if (suspension && counterweightLayout && counterweightReferenceY !== undefined && initialCounterweightY !== undefined && shaft) {
    const offsets = boundsOffsets(counterweightBounds, counterweightReferenceY)
    const envelope = { minY: metres(shaft.bottomY - offsets.min), maxY: metres(shaft.topY - offsets.max) }
    const initialElevation = initial!.elevationY
    const fitsEveryLevel = installation.levels.every((level) => {
      const y = initialCounterweightY - (level.elevationY - initialElevation)
      return y >= envelope.minY && y <= envelope.maxY
    })
    if (fitsEveryLevel) counterweight = {
      referenceY: counterweightReferenceY,
      initialY: initialCounterweightY,
      envelope,
      travelFactor: -1,
    }
  }

  let suspensionRopes = counterweight && suspension ? suspension.ropes : []
  let governorSegments = safety.governor && safety.tension && safety.governorRope && safety.linkage &&
    safety.validation.state !== 'invalid' ? safety.governorRope.segments : []
  let governorLinkagePoint = governorSegments.length ? safety.linkage!.ropeConnection : undefined

  let capabilities: PassengerSimulationCapabilities = {
    cabinMovement: capability(true, 'cabin'),
    counterweightMovement: capability(!!counterweight, 'counterweight.relationship'),
    doorMovement: capability(doorsCanMove(inputs), 'doors.panelTransforms'),
    tractionRotation: capability(!!suspension, 'traction.contactGeometry'),
    suspensionUpdate: capability(suspensionRopes.length > 0, 'suspension.route'),
    governorUpdate: capability(governorSegments.length > 0, 'governor.route'),
  }

  const traction = suspension ? {
    sheaveId: suspension.traction.id,
    contactRadius: suspension.arc.radius,
    rotationSign: (suspension.arc.exitAngle > suspension.arc.entryAngle ? 1 : -1) as -1 | 1,
  } : undefined

  const buildModel = (): PassengerSimulationModel => ({
    levels: installation.levels,
    initialLevelId: initial!.id,
    referenceCabinY: cabin.bottomY,
    cabinEnvelope: { minY: region!.bottomY, maxY: region!.topY },
    capabilities,
    counterweight,
    traction,
    suspensionRopes,
    governorSegments,
    governorLinkagePoint,
    timing,
  })

  // Optional routes are checked at every stop. A bad optional route is removed,
  // while valid cabin movement remains available.
  let model = buildModel()
  if (suspensionRopes.length) {
    const valid = installation.levels.every((level) => {
      const pose = createSimulationPose(model, {
        ...createInitialSimulationState(model), currentLevel: level.id, sourceLevel: level.id, targetLevel: level.id,
      })
      return pose.suspensionRopes.every((rope) => {
        const first = rope.segments[0]
        const last = rope.segments.at(-1)!
        return first.kind === 'line' && last.kind === 'line' && first.start[1] < first.end[1] && last.end[1] < last.start[1]
      })
    })
    if (!valid) suspensionRopes = []
  }
  if (governorSegments.length) {
    const valid = installation.levels.every((level) => {
      const offset = level.elevationY - cabin.bottomY
      const movingY = governorLinkagePoint![1] + offset
      return movingY > safety.tension!.wheel.center[1] && movingY < safety.governor!.wheel.center[1]
    })
    if (!valid) { governorSegments = []; governorLinkagePoint = undefined }
  }
  capabilities = {
    ...capabilities,
    suspensionUpdate: capability(suspensionRopes.length > 0, 'suspension.route'),
    governorUpdate: capability(governorSegments.length > 0, 'governor.route'),
  }
  model = buildModel()
  const poseIssues = installation.levels.flatMap((level) => validateSimulationPose(model, createSimulationPose(model, {
    ...createInitialSimulationState(model), currentLevel: level.id, sourceLevel: level.id, targetLevel: level.id,
  })))
  if (poseIssues.length) return { status: 'invalid', issues: poseIssues }

  const spatialValidation = validatePassengerSpatialGeometry(inputs, {
    counterweightCenterEnvelope: counterweight?.envelope,
  })
  const blockingSpatialIssues = spatialValidation.issues.filter((entry) =>
    entry.severity === 'error' && entry.blocksCabinTravel)
  if (blockingSpatialIssues.length) return {
    status: 'invalid',
    issues: blockingSpatialIssues.map((entry) => ({ code: 'geometric-conflict', path: entry.code })),
  }

  const issues = Object.values(capabilities).flatMap((entry) => entry.issues)
  return {
    status: 'available',
    availability: issues.length ? 'partial' : 'complete',
    model,
    issues,
  }
}
