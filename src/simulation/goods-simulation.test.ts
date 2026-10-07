import { describe, expect, it } from 'vitest'
import { createGoodsLiftQaFixture } from '../dev/fixtures/goods-lift-qa-fixture'
import { createGoodsLiftNormalizedModel } from '../elevator/goods/goods-lift-model'
import { createGoodsLiftSceneModel } from '../elevator/goods/goods-lift-scene-model'
import { validateGoodsLiftSpatialGeometry } from '../collision/goods-lift-spatial-validation'
import { millimetres as mm } from '../engineering'
import { getLiftFamilyCapability, updateGoodsLiftPlanningConfiguration } from '../elevator'
import { getCameraFrameTrigger, transitionCameraInteraction } from '../three/camera/camera-interaction-policy'
import { getGoodsLiftCameraFrame, getGoodsLiftCameraInstallationKey } from '../three/camera/goods-lift-camera'
import { GOODS_LIFT_VIEW_MODES } from '../three/geometry/goods/goods-lift-render-model'
import { createGoodsVisualDoorLayouts, getGoodsAssemblyPosition, getGoodsDoorPanelOffsets, getGoodsDoorProgress, isGoodsMovingAssembly } from '../three/geometry/goods/goods-motion-bindings'
import { createGoodsSimulationController, createGoodsSimulationModel, advanceGoodsSimulation } from './goods-simulation'

function prepared(count = 6, update: Partial<ReturnType<typeof createGoodsLiftQaFixture>> = {}) {
  const configuration = updateGoodsLiftPlanningConfiguration(createGoodsLiftQaFixture(), { stopCount: count, ...update })
  const normalized = createGoodsLiftNormalizedModel(configuration)
  if (normalized.status === 'empty') throw new Error('No geometry')
  const scene = createGoodsLiftSceneModel(normalized.model)
  const validation = validateGoodsLiftSpatialGeometry(normalized)
  const result = createGoodsSimulationModel(normalized, validation)
  return { normalized, scene, validation, result }
}
function runtime(count = 6) {
  const data = prepared(count)
  if (data.result.status !== 'available') throw new Error(JSON.stringify(data.result))
  return { ...data, controller: createGoodsSimulationController(data.result.model) }
}
describe('goods visual simulation', () => {
  it('registers goods with shared carrier playback but without fabricated mechanical behaviors', () => {
    expect(getLiftFamilyCapability('goods', 'simulation').status).toBe('available')
    expect(getLiftFamilyCapability('passenger', 'simulation').status).toBe('available')
    expect(getLiftFamilyCapability('car', 'simulation').status).toBe('available')
    expect(runtime().controller.model.unavailableBehaviors).toContain('driveSimulation')
  })
  it.each([2, 6, 10])('starts, pauses, resumes and resets %i-stop upward/downward travel', (count) => {
    const { controller } = runtime(count)
    expect(controller.dispatch({ type: 'start', targetLevel: `level-${count}` }).ok).toBe(true)
    expect(controller.getState().phase).toBe('door-closing')
    controller.advance(1.5)
    expect(controller.getState().phase).toBe('moving')
    controller.advance(controller.getState().travelDurationSeconds / 2)
    expect(controller.getPose().floorMm).toBe((count - 1) * 1500)
    controller.dispatch({ type: 'pause' })
    const paused = controller.getPose()
    controller.advance(100)
    expect(controller.getPose()).toEqual(paused)
    expect(controller.getState().paused).toBe(true)
    controller.dispatch({ type: 'resume' }); controller.advance(controller.getState().travelDurationSeconds / 2 + 1.5)
    expect(controller.getState()).toMatchObject({ phase: 'door-open', currentLevel: `level-${count}`, targetLevel: `level-${count}`, paused: false })
    expect(controller.getPose()).toMatchObject({ floorMm: (count - 1) * 3000, frontDoorProgress: 1, rearDoorProgress: 1 })
    controller.dispatch({ type: 'start', targetLevel: 'level-1' })
    controller.advance(0.75)
    expect(controller.getPose().floorMm).toBe((count - 1) * 3000)
    expect(controller.getPose().frontDoorProgress).toBeCloseTo(0.5)
    controller.advance(0.75)
    expect(controller.getState()).toMatchObject({ phase: 'moving', doorProgress: 0 })
    controller.advance(controller.getState().travelDurationSeconds + 1.5)
    expect(controller.getPose()).toMatchObject({ floorMm: 0, activeLandingLevel: 'level-1' })
    controller.dispatch({ type: 'reset' })
    expect(controller.getState()).toMatchObject({ phase: 'idle', paused: false, currentLevel: 'level-1', sourceLevel: 'level-1', targetLevel: 'level-1', doorProgress: 0, travelProgress: 0 })
    expect(controller.getPose()).toMatchObject({ floorMm: 0, platformOffsetMm: 0, frontDoorProgress: 0, rearDoorProgress: 0 })
  })
  it('serves 2→5 and explicit nonuniform elevations', () => {
    const { controller } = runtime()
    controller.dispatch({ type: 'start', targetLevel: 'level-2' }); controller.advance(controller.getState().travelDurationSeconds + 3)
    controller.dispatch({ type: 'start', targetLevel: 'level-5' }); controller.advance(controller.getState().travelDurationSeconds + 3)
    expect(controller.getPose().floorMm).toBe(12000)
    const explicit = prepared(2, { storeyHeightsMm: undefined, levelElevationsMm: [mm(700), mm(4200)] }).result
    if (explicit.status !== 'available') throw new Error('Unavailable')
    const c = createGoodsSimulationController(explicit.model)
    c.dispatch({ type: 'start', targetLevel: 'level-2' }); c.advance(c.getState().travelDurationSeconds + 3)
    expect(c.getPose()).toMatchObject({ floorMm: 4200, platformOffsetMm: 3500 })
  })
  it('is invariant to tick subdivision and notifies only at phase/command boundaries', () => {
    const a = runtime().controller, b = runtime().controller
    a.dispatch({ type: 'start', targetLevel: 'level-6' }); b.dispatch({ type: 'start', targetLevel: 'level-6' })
    let notifications = 0
    b.subscribe(() => notifications++)
    const total = a.getState().travelDurationSeconds + 3
    a.advance(total)
    for (let i = 0; i < 900; i++) b.advance(total / 900)
    expect(b.getPose().floorMm).toBeCloseTo(a.getPose().floorMm)
    expect(b.getPose().frontDoorProgress).toBeCloseTo(1)
    expect(notifications).toBeLessThanOrEqual(4)
  })
  it('rejects invalid commands/clocks and motion with open doors without corrupting pose', () => {
    const { controller } = runtime()
    expect(controller.dispatch({ type: 'start', targetLevel: 'missing' }).ok).toBe(false)
    expect(controller.dispatch({ type: 'start', targetLevel: 'level-1' }).ok).toBe(false)
    expect(controller.dispatch({ type: 'pause' }).ok).toBe(false)
    expect(controller.advance(NaN).ok).toBe(false)
    controller.dispatch({ type: 'reset' })
    expect(controller.getState().phase).toBe('idle')
    expect(advanceGoodsSimulation(controller.model, { ...controller.getState(), phase: 'moving', doorProgress: 1 }, 1))
      .toMatchObject({ ok: false, issues: [{ code: 'invalid-state' }] })
  })
  it('preserves partial movement when door/optional load inputs are missing', () => {
    const { result } = prepared(6, { doorWidthMm: undefined, pallet: undefined, rollContainer: undefined, forkliftEnvelope: undefined })
    expect(result).toMatchObject({ status: 'available', availability: 'partial' })
    if (result.status !== 'available') throw new Error('Unavailable')
    expect(result.model.capabilities).toMatchObject({ frontDoorMovement: { available: false }, rearDoorMovement: { available: false }, loadEnvelopeMovement: { available: false } })
    const c = createGoodsSimulationController(result.model)
    c.dispatch({ type: 'start', targetLevel: 'level-6' }); c.advance(c.getState().travelDurationSeconds)
    expect(c.getState()).toMatchObject({ phase: 'idle', currentLevel: 'level-6', doorProgress: 0 })
  })
  it('blocks only genuine travel conflicts, including loads breaching shaft swept bounds', () => {
    expect(prepared(6, { platformWidthMm: mm(2800) }).result.status).toBe('invalid')
    expect(prepared(6, { guideSystem: { orientation: 'x', spacingMm: mm(1400) } }).result.status).toBe('invalid')
    expect(prepared(6, { pallet: { widthMm: mm(3000), depthMm: mm(800), heightMm: mm(1600) } }).result.status).toBe('invalid')
    expect(prepared(6, { pallet: { widthMm: mm(2200), depthMm: mm(800), heightMm: mm(1600) } }).result.status).toBe('invalid')
    expect(prepared(6, { doorWidthMm: mm(2700) }).result.status).toBe('invalid')
    const unrelated = prepared(6, { pallet: { widthMm: mm(1900), depthMm: mm(800), heightMm: mm(1600) } })
    expect(unrelated.validation.status).toBe('invalid')
    expect(unrelated.result.status).toBe('available')
    expect(prepared(1).result.status).toBe('unavailable')
    expect(prepared(6, { shaftWidthMm: undefined }).result.status).toBe('unavailable')
  })
})
describe('goods attachments and schematic doors', () => {
  it.each([2, 6, 10])('moves all carrier attachments, not fixed %i-stop geometry', (count) => {
    const { scene, controller } = runtime(count)
    const before = structuredClone(scene)
    controller.dispatch({ type: 'start', targetLevel: `level-${count}` }); controller.advance(1.5 + controller.getState().travelDurationSeconds / 2)
    for (const a of scene.assemblies) {
      const position = getGoodsAssemblyPosition(a, controller.getPose())
      expect(position[1]).toBeCloseTo(a.center[1] + (isGoodsMovingAssembly(a) ? (count - 1) * 1.5 : 0))
      if (['landing-door', 'shaft', 'guide', 'level', 'moving-envelope'].includes(a.kind)) expect(position).toEqual(a.center)
    }
    expect(scene).toEqual(before)
  })
  it('animates both sides only at the current landing, closes before departure and resets', () => {
    const { scene, controller } = runtime()
    const doors = createGoodsVisualDoorLayouts(scene)
    expect(doors.filter((d) => d.role === 'landing')).toHaveLength(12)
    expect(new Set(doors.map((d) => d.id)).size).toBe(14)
    controller.dispatch({ type: 'start', targetLevel: 'level-5' }); controller.advance(controller.getState().travelDurationSeconds + 3)
    for (const door of doors) {
      const active = door.role === 'platform' || door.levelId === 'level-5'
      expect(getGoodsDoorProgress(door, controller.getPose())).toBe(active ? 1 : 0)
      expect(getGoodsDoorPanelOffsets(door, controller.getPose())).toEqual(active ? [-0.8, 0.8] : [-0, 0])
    }
    controller.dispatch({ type: 'start', targetLevel: 'level-1' }); controller.advance(1.5)
    expect(doors.every((d) => getGoodsDoorProgress(d, controller.getPose()) === 0)).toBe(true)
    controller.dispatch({ type: 'reset' })
    expect(doors.every((d) => getGoodsDoorProgress(d, controller.getPose()) === 0)).toBe(true)
  })
  it.each(['front', 'rear'] as const)('supports %s-only access without opposite-side doors', (side) => {
    const { scene, result } = prepared(6, { throughCar: false, frontAccess: side === 'front', rearAccess: side === 'rear' })
    if (result.status !== 'available') throw new Error('Unavailable')
    expect(result.model.capabilities.frontDoorMovement.available).toBe(side === 'front')
    expect(result.model.capabilities.rearDoorMovement.available).toBe(side === 'rear')
    const doors = createGoodsVisualDoorLayouts(scene)
    expect(doors).toHaveLength(7)
    expect(doors.every((d) => d.side === side)).toBe(true)
    for (const door of doors.filter((d) => d.role === 'landing')) {
      expect(door.center[2]).toBe(side === 'front' ? 1.5 : -1.5)
      expect(door.center[1]).toBe((Number(door.levelId!.slice(6)) - 1) * 3 + 1.1)
    }
  })
  it.each([2, 6, 10])('keeps camera bounds/key stable during %i-stop playback', (count) => {
    const { scene, controller } = runtime(count)
    const key = getGoodsLiftCameraInstallationKey(scene)
    const frames = GOODS_LIFT_VIEW_MODES.map((mode) => getGoodsLiftCameraFrame(scene, mode, true))
    controller.dispatch({ type: 'start', targetLevel: `level-${count}` })
    for (let tick = 0; tick < 90; tick++) {
      controller.advance(0.1)
      expect(getGoodsLiftCameraInstallationKey(scene)).toBe(key)
    }
    expect(GOODS_LIFT_VIEW_MODES.map((mode) => getGoodsLiftCameraFrame(scene, mode, true))).toEqual(frames)
    const request = { viewMode: 'platform', installationKey: key, doorSelectionKey: '', viewportKey: '1280:720', resetRevision: 0 }
    expect(transitionCameraInteraction('user', getCameraFrameTrigger(request, request))).toEqual({ state: 'user', reframe: false })
    expect(getCameraFrameTrigger(request, { ...request, resetRevision: 1 })).toBe('reset')
    expect(frames[1].bounds.width).toBeGreaterThanOrEqual(3.2)
  })
})
