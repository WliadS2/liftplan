import { metres, millimetres, millimetresToMetres, type Millimetres, type MetresPerSecond } from '../engineering'
import { calculateVerticalTravelDuration } from './vertical-travel'
import type { CarrierDriveVisualization } from './carrier-drive-visualization'
import { isLandingSideServed, type NormalizedLanding } from '../elevator/configuration/landing-planning'

export type PlatformSimulationPhase = 'idle' | 'door-closing' | 'moving' | 'door-opening' | 'door-open'
export type PlatformSimulationIssue = { readonly code: 'planning-incomplete' | 'geometric-conflict' | 'invalid-timing'
  | 'invalid-transition' | 'invalid-level' | 'same-level' | 'invalid-clock' | 'invalid-state'; readonly path: string }
export type PlatformSimulationCapabilityName = 'platformMovement' | 'frontDoorMovement' | 'rearDoorMovement' | 'landingDoorMovement' | 'loadEnvelopeMovement'
export interface PlatformVisualizationTiming { readonly source: 'visualization'; readonly doorSeconds: number }
export const PLATFORM_VISUALIZATION_TIMING: PlatformVisualizationTiming = Object.freeze({ source: 'visualization', doorSeconds: 1.5 })
export interface PlatformSimulationModel {
  readonly mechanicalVisualization?:CarrierDriveVisualization
  readonly family: 'goods' | 'car'
  readonly nominalSpeedMetresPerSecond?: MetresPerSecond
  readonly levels: readonly NormalizedLanding[]
  readonly referenceFloorMm: Millimetres
  readonly capabilities: Readonly<Record<PlatformSimulationCapabilityName, { readonly available: boolean; readonly path: string }>>
  /** Physical dynamics remain unsupported; mechanicalVisualization separately declares kinematic bindings. */
  readonly unavailableBehaviors: readonly ['driveSimulation', 'counterweightSimulation', 'ropeSimulation', 'safetyGearSimulation']
  readonly timing: PlatformVisualizationTiming
}
export type PlatformSimulationModelResult =
  | { readonly status: 'available'; readonly availability: 'complete' | 'partial'; readonly model: PlatformSimulationModel }
  | { readonly status: 'unavailable' | 'invalid'; readonly issues: readonly PlatformSimulationIssue[] }

/** Shared vertical carrier playback only. Family adapters own all geometry and travel guards. */
export interface PlatformSimulationState {
  readonly phase: PlatformSimulationPhase
  readonly paused: boolean
  readonly currentLevel: string
  readonly sourceLevel: string
  readonly targetLevel: string
  readonly elapsedSeconds: number
  readonly travelDurationSeconds: number
  readonly travelProgress: number
  readonly doorProgress: number
  readonly closingFrom: number
}
export interface PlatformSimulationPose {
  readonly floorMm: Millimetres
  readonly platformOffsetMm: Millimetres
  readonly activeLandingLevel?: string
  readonly frontDoorProgress: number
  readonly rearDoorProgress: number
}
export type PlatformSimulationCommand = { readonly type: 'start'; readonly targetLevel: string }
  | { readonly type: 'pause' } | { readonly type: 'resume' } | { readonly type: 'reset' }
export type PlatformSimulationResult = { readonly ok: true; readonly state: PlatformSimulationState }
  | { readonly ok: false; readonly issues: readonly PlatformSimulationIssue[] }
const reject = (code: PlatformSimulationIssue['code'], path: string): PlatformSimulationResult => ({ ok: false, issues: [{ code, path }] })
const smooth = (t: number) => t * t * (3 - 2 * t) // Visual interpolation, not a physical motion curve.
const hasDoors = (model: PlatformSimulationModel) => model.capabilities.landingDoorMovement.available
const level = (model: PlatformSimulationModel, id: string) => model.levels.find((entry) => entry.id === id)
export function createInitialPlatformSimulationState(model: PlatformSimulationModel): PlatformSimulationState {
  const first = model.levels[0].id
  return { phase: 'idle', paused: false, currentLevel: first, sourceLevel: first, targetLevel: first,
    elapsedSeconds: 0, travelDurationSeconds: 0, travelProgress: 0, doorProgress: 0, closingFrom: 0 }
}
export function dispatchPlatformSimulationCommand(model: PlatformSimulationModel, state: PlatformSimulationState,
  command: PlatformSimulationCommand): PlatformSimulationResult {
  if (command.type === 'reset') return { ok: true, state: createInitialPlatformSimulationState(model) }
  const resting = state.phase === 'idle' || state.phase === 'door-open'
  if (command.type === 'pause' || command.type === 'resume') {
    if (resting || state.paused === (command.type === 'pause')) return reject('invalid-transition', command.type)
    return { ok: true, state: { ...state, paused: command.type === 'pause' } }
  }
  if (!resting || state.paused) return reject('invalid-transition', 'start')
  if (!level(model, command.targetLevel) || !level(model, state.currentLevel)) return reject('invalid-level', 'targetLevel')
  if (command.targetLevel === state.currentLevel) return reject('same-level', 'targetLevel')
  const duration = calculateVerticalTravelDuration(millimetresToMetres(level(model, state.currentLevel)!.elevationMm),
    millimetresToMetres(level(model, command.targetLevel)!.elevationMm), model.nominalSpeedMetresPerSecond)
  if (duration.status !== 'available') return reject(duration.status === 'unknown' ? 'planning-incomplete' : 'invalid-timing', duration.path)
  return { ok: true, state: { ...state, travelDurationSeconds: duration.seconds, phase: hasDoors(model) ? 'door-closing' : 'moving',
    sourceLevel: state.currentLevel, targetLevel: command.targetLevel, elapsedSeconds: 0,
    travelProgress: 0, closingFrom: state.doorProgress } }
}
export function createPlatformSimulationPose(model: PlatformSimulationModel, state: PlatformSimulationState): PlatformSimulationPose {
  const source = level(model, state.sourceLevel)!, target = level(model, state.targetLevel)!
  const floorMm = state.phase === 'moving'
    ? millimetres(source.elevationMm + (target.elevationMm - source.elevationMm) * state.travelProgress)
    : level(model, state.currentLevel)!.elevationMm
  return { floorMm, platformOffsetMm: millimetres(floorMm - model.referenceFloorMm),
    activeLandingLevel: state.phase === 'moving' ? undefined : state.currentLevel,
    frontDoorProgress: model.capabilities.frontDoorMovement.available && isLandingSideServed(level(model,state.currentLevel)!, 'front') ? state.doorProgress : 0,
    rearDoorProgress: model.capabilities.rearDoorMovement.available && isLandingSideServed(level(model,state.currentLevel)!, 'rear') ? state.doorProgress : 0 }
}
export function advancePlatformSimulation(model: PlatformSimulationModel, state: PlatformSimulationState, deltaSeconds: number): PlatformSimulationResult {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) return reject('invalid-clock', 'deltaSeconds')
  if (![state.currentLevel, state.sourceLevel, state.targetLevel].every((id) => level(model, id))) return reject('invalid-level', 'state.levels')
  if (![state.elapsedSeconds, state.travelProgress, state.doorProgress, state.closingFrom].every(Number.isFinite) ||
    state.elapsedSeconds < 0 || [state.travelProgress, state.doorProgress, state.closingFrom].some((p) => p < 0 || p > 1)) return reject('invalid-state', 'state')
  if (state.phase === 'moving' && state.doorProgress !== 0) return reject('invalid-state', 'moving.doors')
  if (state.paused || state.phase === 'idle' || state.phase === 'door-open') return { ok: true, state }
  let next = state, remaining = deltaSeconds
  while (remaining > 0 && next.phase !== 'idle' && next.phase !== 'door-open') {
    const duration = next.phase === 'moving' ? next.travelDurationSeconds : model.timing.doorSeconds
    if (!Number.isFinite(duration) || duration <= 0 || next.elapsedSeconds > duration) return reject('invalid-timing', next.phase)
    const elapsed = Math.min(duration - next.elapsedSeconds, remaining)
    remaining -= elapsed
    let phaseElapsed = next.elapsedSeconds + elapsed
    if (duration - phaseElapsed <= Number.EPSILON * 16 * Math.max(1, duration)) phaseElapsed = duration
    const progress = smooth(phaseElapsed / duration)
    next = { ...next, elapsedSeconds: phaseElapsed,
      travelProgress: next.phase === 'moving' ? phaseElapsed / duration : next.travelProgress,
      doorProgress: next.phase === 'door-closing' ? next.closingFrom * (1 - progress)
        : next.phase === 'door-opening' ? progress : 0 }
    if (phaseElapsed === duration) {
      if (next.phase === 'door-closing') next = { ...next, phase: 'moving', elapsedSeconds: 0, doorProgress: 0 }
      else if (next.phase === 'moving') next = { ...next, phase: hasDoors(model) ? 'door-opening' : 'idle',
        currentLevel: next.targetLevel, elapsedSeconds: 0, travelProgress: 1 }
      else next = { ...next, phase: 'door-open', elapsedSeconds: 0, doorProgress: 1 }
    }
  }
  return { ok: true, state: next }
}

/** Ephemeral external runtime; only commands/phase transitions notify UI, never frame-by-frame project writes. */
export function createPlatformSimulationController(model: PlatformSimulationModel) {
  let state = createInitialPlatformSimulationState(model)
  let pose = createPlatformSimulationPose(model, state)
  let snapshot = { state, issues: [] as readonly PlatformSimulationIssue[] }
  let halted = false
  const listeners = new Set<() => void>()
  function commit(result: PlatformSimulationResult, notify: boolean) {
    if (result.ok) {
      notify ||= state.phase !== result.state.phase || state.currentLevel !== result.state.currentLevel
      state = result.state
      pose = createPlatformSimulationPose(model, state)
    }
    if (!result.ok || notify) {
      snapshot = { state, issues: result.ok ? [] : result.issues }
      listeners.forEach((listener) => listener())
    }
    return result
  }
  return { get model() { return model },
    get speedStatus() { return calculateVerticalTravelDuration(metres(0), metres(0), model.nominalSpeedMetresPerSecond).status },
    setNominalSpeed: (speed: MetresPerSecond | undefined) => { model = { ...model, nominalSpeedMetresPerSecond: speed } },
    getState: () => state, getPose: () => pose, getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispatch: (command: PlatformSimulationCommand) => {
      const result = dispatchPlatformSimulationCommand(model, state, command)
      if (result.ok) halted = false
      return commit(result, true)
    },
    advance: (deltaSeconds: number) => {
      if (halted) return { ok: false as const, issues: snapshot.issues }
      const result = advancePlatformSimulation(model, state, deltaSeconds)
      if (!result.ok) halted = true
      return commit(result, false)
    },
  }
}
export type PlatformSimulationController = ReturnType<typeof createPlatformSimulationController>
