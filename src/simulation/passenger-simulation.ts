import { metres, type Metres } from '../engineering'
import type { PassengerLandingLevelModel } from '../three/geometry/passenger/passenger-installation-model'
import type { CableSegment } from '../three/geometry/passenger/mechanical/cable-segment'
import type { MechanicalPoint } from '../three/geometry/passenger/mechanical/passenger-mechanical-layout'

export type SimulationPhase = 'idle' | 'door-closing' | 'moving' | 'arriving' | 'door-opening' | 'door-open'
export type TravelDirection = 'up' | 'down' | 'none'
export type SimulationIssueCode = 'unavailable-data' | 'invalid-timing' | 'unsupported-suspension'
  | 'invalid-level' | 'same-level' | 'invalid-transition' | 'doors-open' | 'outside-envelope' | 'non-finite-pose' | 'invalid-clock' | 'invalid-route'
  | 'geometric-conflict'
export interface SimulationIssue { readonly code: SimulationIssueCode; readonly path: string }
export interface VisualizationTiming {
  readonly source: 'demo' | 'visualization'
  readonly doorOpeningSeconds: number
  readonly doorClosingSeconds: number
  readonly dwellSeconds: number
  readonly travelSeconds: number
  readonly arrivalSeconds: number
}
export interface SimulationEnvelope { readonly minY: Metres; readonly maxY: Metres }
export interface SimulationRope { readonly id: string; readonly segments: readonly CableSegment[]; readonly startAttachment: 'car' | 'counterweight'; readonly endAttachment: 'car' | 'counterweight' }
export type PassengerSimulationCapabilityName = 'cabinMovement' | 'counterweightMovement' | 'doorMovement'
  | 'tractionRotation' | 'suspensionUpdate' | 'governorUpdate'
export interface PassengerSimulationCapability {
  readonly available: boolean
  readonly issues: readonly SimulationIssue[]
}
export type PassengerSimulationCapabilities = Readonly<Record<PassengerSimulationCapabilityName, PassengerSimulationCapability>>
export interface PassengerSimulationModel {
  readonly levels: readonly PassengerLandingLevelModel[]
  readonly initialLevelId: string
  readonly referenceCabinY: Metres
  readonly cabinEnvelope: SimulationEnvelope
  readonly capabilities: PassengerSimulationCapabilities
  readonly counterweight?: {
    readonly referenceY: Metres
    readonly initialY: Metres
    readonly envelope: SimulationEnvelope
    readonly travelFactor: -1
  }
  readonly traction?: {
    readonly sheaveId: string
    readonly contactRadius: Metres
    readonly rotationSign: -1 | 1
  }
  readonly suspensionRopes: readonly SimulationRope[]
  readonly governorSegments: readonly CableSegment[]
  readonly governorLinkagePoint?: MechanicalPoint
  readonly timing: VisualizationTiming
}
export interface PassengerSimulationState {
  readonly phase: SimulationPhase
  readonly paused: boolean
  readonly currentLevel: string
  readonly targetLevel: string
  readonly sourceLevel: string
  readonly closingPurpose: 'departure' | 'completion'
  readonly phaseElapsedSeconds: number
  readonly travelProgress: number
  readonly doorProgress: number
  readonly travelDirection: TravelDirection
}
export interface SimulationPose {
  /** Cabin floor and counterweight centre, in canonical world metres. */
  readonly cabinY: Metres
  readonly counterweightY?: Metres
  readonly cabinOffsetY: Metres
  readonly counterweightOffsetY?: Metres
  readonly tractionSheaveRotation?: number
  readonly cabinDoorProgress: number
  readonly activeLandingDoorProgress: number
  readonly activeLandingLevel?: string
  readonly simulationState: SimulationPhase
  readonly travelDirection: TravelDirection
  readonly travelProgress: number
  readonly suspensionRopes: readonly { readonly id: string; readonly segments: readonly CableSegment[] }[]
  readonly governorSegments: readonly CableSegment[]
}
export type SimulationResult = { readonly ok: true; readonly state: PassengerSimulationState } | { readonly ok: false; readonly issues: readonly SimulationIssue[] }
export type SimulationCommand = { readonly type: 'start'; readonly targetLevel: string } | { readonly type: 'pause' } | { readonly type: 'resume' } | { readonly type: 'reset' }
const reject = (code: SimulationIssueCode, path: string): SimulationResult => ({ ok: false, issues: [{ code, path }] })

/** Visualization interpolation only, not an elevator acceleration or jerk profile. */
export function smoothVisualizationProgress(progress: number): number {
  const t = Math.max(0, Math.min(1, progress))
  return t * t * (3 - 2 * t)
}
export function createInitialSimulationState(model: PassengerSimulationModel): PassengerSimulationState {
  return { phase: 'idle', paused: false, currentLevel: model.initialLevelId, targetLevel: model.initialLevelId,
    sourceLevel: model.initialLevelId, closingPurpose: 'departure', phaseElapsedSeconds: 0,
    travelProgress: 0, doorProgress: 0, travelDirection: 'none' }
}
const inside = (y: number, envelope: SimulationEnvelope) => Number.isFinite(y) && y >= envelope.minY && y <= envelope.maxY
function level(model: PassengerSimulationModel, id: string) { return model.levels.find((entry) => entry.id === id) }

export function dispatchSimulationCommand(model: PassengerSimulationModel, state: PassengerSimulationState, command: SimulationCommand): SimulationResult {
  if (command.type === 'reset') return { ok: true, state: createInitialSimulationState(model) }
  if (command.type === 'pause' || command.type === 'resume') {
    if (state.phase === 'idle' || state.paused === (command.type === 'pause')) return reject('invalid-transition', command.type)
    return { ok: true, state: { ...state, paused: command.type === 'pause' } }
  }
  if (state.doorProgress !== 0) return reject('doors-open', 'doorProgress')
  if (state.phase !== 'idle' || state.paused) return reject('invalid-transition', 'start')
  const target = level(model, command.targetLevel), source = level(model, state.currentLevel)
  if (!target || !source || !Number.isFinite(target.elevationY) || !Number.isFinite(source.elevationY)) return reject('invalid-level', 'targetLevel')
  if (target.id === source.id) return reject('same-level', 'targetLevel')
  const initial = level(model, model.initialLevelId)!
  const counterweightY = model.counterweight
    ? model.counterweight.initialY + model.counterweight.travelFactor * (target.elevationY - initial.elevationY)
    : undefined
  if (!inside(target.elevationY, model.cabinEnvelope) ||
    (counterweightY !== undefined && !inside(counterweightY, model.counterweight!.envelope))) return reject('outside-envelope', 'targetLevel')
  return { ok: true, state: { ...state, phase: model.capabilities.doorMovement.available ? 'door-closing' : 'moving', sourceLevel: source.id, targetLevel: target.id,
    closingPurpose: 'departure', phaseElapsedSeconds: 0, travelProgress: 0,
    travelDirection: target.elevationY > source.elevationY ? 'up' : 'down' } }
}

function nextPhase(model: PassengerSimulationModel, state: PassengerSimulationState): PassengerSimulationState {
  const next = { ...state, phaseElapsedSeconds: 0 }
  switch (state.phase) {
    case 'door-closing': return state.closingPurpose === 'departure'
      ? { ...next, phase: 'moving', doorProgress: 0 }
      : { ...next, phase: 'idle', doorProgress: 0, travelDirection: 'none' }
    case 'moving': return { ...next, phase: 'arriving', currentLevel: state.targetLevel, travelProgress: 1 }
    case 'arriving': return model.capabilities.doorMovement.available
      ? { ...next, phase: 'door-opening', travelDirection: 'none' }
      : { ...next, phase: 'idle', travelDirection: 'none' }
    case 'door-opening': return { ...next, phase: 'door-open', doorProgress: 1 }
    case 'door-open': return { ...next, phase: 'door-closing', closingPurpose: 'completion' }
    case 'idle': return next
  }
}
function phaseDuration(model: PassengerSimulationModel, state: PassengerSimulationState): number {
  const timing = model.timing
  return { idle: 0, 'door-closing': timing.doorClosingSeconds, moving: timing.travelSeconds,
    arriving: timing.arrivalSeconds, 'door-opening': timing.doorOpeningSeconds, 'door-open': timing.dwellSeconds }[state.phase]
}
/** Consume all elapsed time across boundaries; subdividing a tick cannot change the resulting phase/pose. */
export function advanceSimulation(model: PassengerSimulationModel, state: PassengerSimulationState, deltaSeconds: number): SimulationResult {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) return reject('invalid-clock', 'deltaSeconds')
  if (![state.currentLevel, state.sourceLevel, state.targetLevel].every((id) => Number.isFinite(level(model, id)?.elevationY))) return reject('invalid-level', 'state.levels')
  if (!Number.isFinite(state.phaseElapsedSeconds) || state.phaseElapsedSeconds < 0 || !Number.isFinite(state.travelProgress) || !Number.isFinite(state.doorProgress)) return reject('non-finite-pose', 'state')
  if (state.paused || state.phase === 'idle') return { ok: true, state }
  let next = state, remaining = deltaSeconds
  while (remaining > 0 && next.phase !== 'idle') {
    if (next.phase === 'moving' && next.doorProgress !== 0) return reject('doors-open', 'doorProgress')
    const duration = phaseDuration(model, next)
    if (!Number.isFinite(duration) || duration <= 0) return reject('invalid-timing', next.phase)
    const elapsed = Math.min(duration - next.phaseElapsedSeconds, remaining)
    remaining -= elapsed
    next = { ...next, phaseElapsedSeconds: next.phaseElapsedSeconds + elapsed }
    // Round only floating-point accumulation at a phase boundary, never physical timing or clearances.
    if (duration - next.phaseElapsedSeconds <= Number.EPSILON * 16 * Math.max(1, duration)) next = { ...next, phaseElapsedSeconds: duration }
    const progress = smoothVisualizationProgress(next.phaseElapsedSeconds / duration)
    if (next.phase === 'moving') next = { ...next, travelProgress: progress }
    if (next.phase === 'door-opening') next = { ...next, doorProgress: progress }
    if (next.phase === 'door-closing') next = { ...next, doorProgress: next.closingPurpose === 'completion' ? 1 - progress : 0 }
    if (next.phaseElapsedSeconds >= duration) next = nextPhase(model, next)
  }
  const issues = validateSimulationPose(model, createSimulationPose(model, next))
  return issues.length ? { ok: false, issues } : { ok: true, state: next }
}

const translate = (point: MechanicalPoint, y: number): MechanicalPoint => [point[0], metres(point[1] + y), point[2]]
const matches = (a: MechanicalPoint, b: MechanicalPoint) => a.every((value, axis) => Math.abs(value - b[axis]) < 1e-9)
export function createSimulationPose(model: PassengerSimulationModel, state: PassengerSimulationState): SimulationPose {
  const source = level(model, state.sourceLevel)!, target = level(model, state.targetLevel)!, initial = level(model, model.initialLevelId)!
  const cabinY = state.phase === 'moving' ? metres(source.elevationY + (target.elevationY - source.elevationY) * state.travelProgress)
    : state.phase === 'door-closing' && state.closingPurpose === 'departure' ? source.elevationY : level(model, state.currentLevel)!.elevationY
  const counterweightY = model.counterweight
    ? metres(model.counterweight.initialY + model.counterweight.travelFactor * (cabinY - initial.elevationY))
    : undefined
  const cabinOffsetY = metres(cabinY - model.referenceCabinY)
  const counterweightOffsetY = counterweightY === undefined ? undefined : metres(counterweightY - model.counterweight!.referenceY)
  const suspensionRopes = model.suspensionRopes.map((rope) => ({ id: rope.id, segments: rope.segments.map((segment, index): CableSegment => {
    if (segment.kind === 'arc') return segment
    return { ...segment, start: index === 0 ? translate(segment.start, rope.startAttachment === 'car' ? cabinOffsetY : counterweightOffsetY ?? metres(0)) : segment.start,
      end: index === rope.segments.length - 1 ? translate(segment.end, rope.endAttachment === 'car' ? cabinOffsetY : counterweightOffsetY ?? metres(0)) : segment.end }
  }) }))
  const governorSegments = model.governorLinkagePoint ? model.governorSegments.map((segment): CableSegment => segment.kind === 'arc' ? segment : ({ ...segment,
    start: matches(segment.start, model.governorLinkagePoint!) ? translate(segment.start, cabinOffsetY) : segment.start,
    end: matches(segment.end, model.governorLinkagePoint!) ? translate(segment.end, cabinOffsetY) : segment.end })) : []
  return { cabinY, counterweightY, cabinOffsetY, counterweightOffsetY,
    tractionSheaveRotation: model.traction ? (cabinY === initial.elevationY ? 0 : model.traction.rotationSign * (cabinY - initial.elevationY) / model.traction.contactRadius) : undefined,
    cabinDoorProgress: model.capabilities.doorMovement.available ? state.doorProgress : 0,
    activeLandingDoorProgress: model.capabilities.doorMovement.available ? state.doorProgress : 0,
    activeLandingLevel: model.capabilities.doorMovement.available && state.phase !== 'moving' ? state.currentLevel : undefined,
    simulationState: state.phase, travelDirection: state.travelDirection, travelProgress: state.travelProgress,
    suspensionRopes, governorSegments }
}

export function validateSimulationPose(model: PassengerSimulationModel, pose: SimulationPose): readonly SimulationIssue[] {
  const issues: SimulationIssue[] = []
  const finiteValues = [pose.cabinY, pose.cabinOffsetY, pose.cabinDoorProgress, pose.activeLandingDoorProgress, pose.travelProgress,
    pose.counterweightY, pose.counterweightOffsetY, pose.tractionSheaveRotation].filter((value): value is number => value !== undefined)
  if (!finiteValues.every(Number.isFinite)) issues.push({ code: 'non-finite-pose', path: 'pose' })
  if (!inside(pose.cabinY, model.cabinEnvelope) ||
    (pose.counterweightY !== undefined && model.counterweight && !inside(pose.counterweightY, model.counterweight.envelope))) issues.push({ code: 'outside-envelope', path: 'pose' })
  if ([pose.travelProgress, pose.cabinDoorProgress, pose.activeLandingDoorProgress].some((p) => p < 0 || p > 1)) issues.push({ code: 'invalid-transition', path: 'progress' })
  if (pose.simulationState === 'moving' && (pose.cabinDoorProgress !== 0 || pose.activeLandingDoorProgress !== 0)) issues.push({ code: 'doors-open', path: 'pose' })
  for (const segment of [...pose.suspensionRopes.flatMap((rope) => rope.segments), ...pose.governorSegments]) {
    if (segment.kind === 'line' && (![...segment.start, ...segment.end].every(Number.isFinite) || Math.hypot(...segment.end.map((v, i) => v - segment.start[i])) === 0)) issues.push({ code: 'invalid-route', path: 'pose.ropes' })
    if (segment.kind === 'arc' && (![...segment.center, segment.rotationY, segment.radius, segment.axialOffset, segment.entryAngle, segment.exitAngle].every(Number.isFinite) || segment.radius <= 0)) issues.push({ code: 'invalid-route', path: 'pose.ropes' })
  }
  return issues
}

/** Runtime external controller: UI notifications are phase/command based, never 60fps project updates. */
export function createPassengerSimulationController(model: PassengerSimulationModel) {
  let state = createInitialSimulationState(model), pose = createSimulationPose(model, state)
  let halted = false
  let snapshot = { state, issues: [] as readonly SimulationIssue[] }
  const listeners = new Set<() => void>()
  function commit(result: SimulationResult, notify: boolean) {
    if (result.ok) {
      const previous = state
      state = result.state
      if (previous !== state) pose = createSimulationPose(model, state)
      notify ||= previous.phase !== state.phase || previous.currentLevel !== state.currentLevel
    } else notify = true
    if (notify) { snapshot = { state, issues: result.ok ? [] : result.issues }; listeners.forEach((listener) => listener()) }
    return result
  }
  return {
    model,
    getPose: () => pose,
    getState: () => state,
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispatch: (command: SimulationCommand) => {
      const result = dispatchSimulationCommand(model, state, command)
      if (result.ok) halted = false
      return commit(result, true)
    },
    advance: (deltaSeconds: number) => {
      if (halted) return { ok: false as const, issues: snapshot.issues }
      const result = advanceSimulation(model, state, deltaSeconds)
      if (!result.ok) halted = true
      return commit(result, false)
    },
  }
}
export type PassengerSimulationController = ReturnType<typeof createPassengerSimulationController>
