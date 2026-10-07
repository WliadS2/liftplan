import { describe, expect, it, vi } from 'vitest'
import { createPassengerSimulationFixture, PASSENGER_SIMULATION_DEMO_DATA } from '../dev/fixtures/passenger-simulation-demo'
import { createPassengerMechanicalFixture } from '../dev/fixtures/passenger-mechanical-fixture'
import { createPassengerDoorDemo } from '../dev/fixtures/passenger-door-demo'
import { createLiftGeometryPlanningInput } from '../three/geometry/lift-geometry-planning-input'
import { createPassengerInstallationModel } from '../three/geometry/passenger/passenger-installation-model'
import { createPassengerMechanicalLayout } from '../three/geometry/passenger/mechanical/passenger-mechanical-layout'
import { createPassengerMechanicalComponents } from '../three/geometry/passenger/mechanical/mechanical-component-model'
import { createTractionDriveModel } from '../three/geometry/passenger/mechanical/traction-drive-model'
import { createPassengerSafetyModel } from '../three/geometry/passenger/mechanical/passenger-safety-model'
import { createPassengerDoorSystem, getDoorPanelParts } from '../three/geometry/passenger/doors/passenger-door-model'
import { createProjectStore } from '../projects/project-store'
import { metres, millimetres, metresPerSecond } from '../engineering'
import { createPassengerPlanningConfiguration, type PassengerPlanningConfiguration } from '../elevator'
import { createPassengerSimulationModel, type PassengerVisualizationData } from './passenger-simulation-model'
import { PASSENGER_VISUALIZATION_TIMING } from './passenger-visualization-profile'
import { advanceSimulation, createInitialSimulationState, createPassengerSimulationController, createSimulationPose,
  dispatchSimulationCommand, smoothVisualizationProgress, validateSimulationPose, type SimulationResult } from './passenger-simulation'
import { getDoorMotionProgress, getDoorPanelOffset } from './passenger-motion-bindings'
import { getPassengerCameraFrame } from '../three/camera/passenger-camera-bounds'
import { getPassengerSimulationCameraFrame } from '../three/camera/passenger-simulation-camera-frame'

function normalize(configuration: PassengerPlanningConfiguration) {
  const input = createLiftGeometryPlanningInput(configuration)!
  const result = createPassengerInstallationModel(input)
  if (!('model' in result) || !result.model) throw new Error('Expected installation')
  const installation = result.model, layout = createPassengerMechanicalLayout(input, installation)
  const components = createPassengerMechanicalComponents(input.mechanical.components, layout)
  const drive = createTractionDriveModel(input.mechanical.drive, installation, layout, components)
  const safety = createPassengerSafetyModel(input.mechanical.safety, installation, layout, components, drive.machine)
  const doors = createPassengerDoorSystem(input.doors, installation)
  return { planning: input, installation, layout, components, drive, safety, doors }
}
function normalConfiguration(stopCount = 6): PassengerPlanningConfiguration {
  return {
    ...createPassengerPlanningConfiguration('Normales Planungsprojekt'),
    stopCount,
    ratedSpeedMetresPerSecond: metresPerSecond(1),
    floorHeightMm: millimetres(3000),
    cabinLevelIndex: 0,
    cabinWidthMm: millimetres(1100),
    cabinDepthMm: millimetres(1400),
    cabinHeightMm: millimetres(2200),
    doorWidthMm: millimetres(900),
    doorHeightMm: millimetres(2100),
    shaftWidthMm: millimetres(2000),
    shaftDepthMm: millimetres(2200),
    pitDepthMm: millimetres(1000),
    headroomMm: millimetres(2600),
    throughCar: false,
  }
}
function setup(count = 6, arrangement: 'rear' | 'left' | 'right' = 'rear', throughCar = false) {
  const configuration = createPassengerSimulationFixture(arrangement, throughCar, count)
  const inputs = normalize(configuration), result = createPassengerSimulationModel(inputs, PASSENGER_SIMULATION_DEMO_DATA)
  if (result.status !== 'available') throw new Error(JSON.stringify(result))
  return { configuration, inputs, model: result.model, controller: createPassengerSimulationController(result.model) }
}
function state(result: SimulationResult) {
  if (!result.ok) throw new Error(JSON.stringify(result.issues))
  return result.state
}

describe('deterministic passenger kinematic visualization', () => {
  it('runs the exact close, travel, arrive, open, dwell, close, idle cycle', () => {
    const { controller: c, model } = setup()
    expect(c.getState().phase).toBe('idle')
    c.dispatch({ type: 'start', targetLevel: 'level-6' })
    expect(c.getState().phase).toBe('door-closing')
    c.advance(model.timing.doorClosingSeconds)
    expect(c.getState().phase).toBe('moving')
    c.advance(c.getState().travelDurationSeconds)
    expect(c.getState()).toMatchObject({ phase: 'arriving', currentLevel: 'level-6', targetLevel: 'level-6', travelProgress: 1 })
    expect(c.getPose().cabinY).toBe(15)
    c.advance(model.timing.arrivalSeconds)
    expect(c.getState().phase).toBe('door-opening')
    c.advance(model.timing.doorOpeningSeconds)
    expect(c.getState()).toMatchObject({ phase: 'door-open', doorProgress: 1 })
    c.advance(model.timing.dwellSeconds)
    expect(c.getState()).toMatchObject({ phase: 'door-closing', closingPurpose: 'completion' })
    c.advance(model.timing.doorClosingSeconds)
    expect(c.getState()).toMatchObject({ phase: 'idle', doorProgress: 0, currentLevel: 'level-6' })
  })

  it.each([2, 6, 10])('moves up/down across %i stops with exact arrival and inverse bounded counterweight motion', (count) => {
    const { controller: c, model } = setup(count)
    const target = model.levels.at(-1)!
    c.dispatch({ type: 'start', targetLevel: target.id }); c.advance(model.timing.doorClosingSeconds)
    const cabinStart = c.getPose().cabinY, cwStart = c.getPose().counterweightY
    for (let tick = 0; tick < 80; tick++) {
      c.advance(c.getState().travelDurationSeconds / 80)
      const pose = c.getPose()
      expect(validateSimulationPose(model, pose)).toEqual([])
      expect(pose.travelProgress).toBeGreaterThanOrEqual(0); expect(pose.travelProgress).toBeLessThanOrEqual(1)
      expect(pose.counterweightY! - cwStart!).toBeCloseTo(-(pose.cabinY - cabinStart))
      expect(pose.cabinDoorProgress).toBe(0)
    }
    expect(c.getPose().cabinY).toBe(target.elevationY)
    expect(c.getState().currentLevel).toBe(target.id)
    c.advance(20)
    c.dispatch({ type: 'start', targetLevel: 'level-1' }); c.advance(model.timing.doorClosingSeconds)
    expect(c.getPose().travelDirection).toBe('down')
    c.advance(c.getState().travelDurationSeconds)
    expect(c.getPose().cabinY).toBe(model.levels[0].elevationY)
    expect(c.getPose().counterweightY).toBe(model.counterweight!.initialY)
    expect(c.getPose().tractionSheaveRotation).toBe(0)
  })

  it.each(['rear', 'left', 'right'] as const)('keeps %s moving assemblies, four rope lanes and fixed wraps connected', (arrangement) => {
    const { controller: c, model, inputs } = setup(10, arrangement, true)
    c.dispatch({ type: 'start', targetLevel: 'level-10' }); c.advance(6)
    const pose = c.getPose(), original = inputs.drive.suspension!.ropes
    expect(pose.suspensionRopes).toHaveLength(4)
    pose.suspensionRopes.forEach((rope, index) => {
      const first = rope.segments[0], last = rope.segments.at(-1)!, sourceFirst = original[index].segments[0], sourceLast = original[index].segments.at(-1)!
      if (first.kind !== 'line' || last.kind !== 'line' || sourceFirst.kind !== 'line' || sourceLast.kind !== 'line') throw new Error('Expected endpoint segments')
      expect(first.start[1]).toBe(sourceFirst.start[1] + pose.cabinOffsetY)
      expect(last.end[1]).toBe(sourceLast.end[1] + pose.counterweightOffsetY!)
      expect(first.end).toEqual(sourceFirst.end); expect(last.start).toEqual(sourceLast.start)
      expect(rope.segments[1]).toBe(original[index].segments[1])
    })
    expect(pose.tractionSheaveRotation).toBe(model.traction!.rotationSign * (pose.cabinY - model.levels[0].elevationY) / model.traction!.contactRadius)
    const connection = model.governorLinkagePoint!
    const attached = pose.governorSegments.filter((segment) => segment.kind === 'line' && (segment.start[1] === connection[1] + pose.cabinOffsetY || segment.end[1] === connection[1] + pose.cabinOffsetY))
    expect(attached).toHaveLength(2)
    expect(pose.governorSegments.filter((segment) => segment.kind === 'arc')).toEqual(model.governorSegments.filter((segment) => segment.kind === 'arc'))
    const members = [...inputs.components.carSling!.boxes, ...inputs.components.carGuideShoes.flatMap((shoe) => shoe.boxes), ...inputs.safety.gears.flatMap((gear) => gear.boxes)]
    members.forEach((part) => expect(part.center[1] + pose.cabinOffsetY - pose.cabinY).toBeCloseTo(part.center[1] - model.referenceCabinY))
  })

  it('opens cabin and served landing panels together; all other landings remain closed', () => {
    const { controller: c, inputs, model } = setup(6, 'rear', true)
    c.dispatch({ type: 'start', targetLevel: 'level-6' }); c.advance(model.timing.doorClosingSeconds + c.getState().travelDurationSeconds + model.timing.arrivalSeconds + model.timing.doorOpeningSeconds / 2)
    const pose = c.getPose()
    expect(pose.simulationState).toBe('door-opening')
    expect(pose.cabinDoorProgress).toBeCloseTo(0.5)
    for (const entry of [...inputs.doors.cabin, ...inputs.doors.landings]) {
      const expected = entry.role === 'cabin' || entry.levelId === 'level-6' ? pose.cabinDoorProgress : 0
      expect(getDoorMotionProgress(entry, pose)).toBe(expected)
      entry.panels.forEach((panel) => {
        expect(getDoorPanelOffset(entry, panel, pose)).toEqual(panel.travel.map((value) => value * expected))
        const parts = getDoorPanelParts(entry, panel)
        expect(parts.boxes.length).toBeGreaterThanOrEqual(3)
        expect(parts.cylinders.length).toBeGreaterThanOrEqual(2)
      })
    }
    c.advance(1)
    expect(c.getPose().cabinDoorProgress).toBe(1)
    c.advance(4)
    expect(c.getPose().cabinDoorProgress).toBeCloseTo(0.5)
  })

  it('rejects invalid commands, open-door travel, unknown/same/non-finite levels and impossible envelopes', () => {
    const { controller: c, model } = setup()
    expect(c.dispatch({ type: 'pause' }).ok).toBe(false)
    expect(c.dispatch({ type: 'start', targetLevel: 'missing' })).toMatchObject({ ok: false, issues: [{ code: 'invalid-level' }] })
    expect(c.dispatch({ type: 'start', targetLevel: 'level-1' })).toMatchObject({ ok: false, issues: [{ code: 'same-level' }] })
    const initial = createInitialSimulationState(model)
    expect(dispatchSimulationCommand(model, { ...initial, doorProgress: 1 }, { type: 'start', targetLevel: 'level-6' })).toMatchObject({ ok: false, issues: [{ code: 'doors-open' }] })
    const invalid = { ...model, levels: model.levels.map((entry) => entry.id === 'level-6' ? { ...entry, elevationY: metres(Infinity) } : entry) }
    expect(dispatchSimulationCommand(invalid, initial, { type: 'start', targetLevel: 'level-6' })).toMatchObject({ ok: false, issues: [{ code: 'invalid-level' }] })
    expect(dispatchSimulationCommand({ ...model, counterweight: { ...model.counterweight!, envelope: { minY: metres(100), maxY: metres(101) } } }, initial, { type: 'start', targetLevel: 'level-6' }).ok).toBe(false)
    c.dispatch({ type: 'start', targetLevel: 'level-6' }); c.advance(2)
    expect(c.dispatch({ type: 'start', targetLevel: 'level-2' }).ok).toBe(false)
    expect(advanceSimulation(model, { ...c.getState(), doorProgress: 0.2 }, 1)).toMatchObject({ ok: false, issues: [{ code: 'doors-open' }] })
    expect(c.advance(NaN).ok).toBe(false)
    expect(c.advance(-1).ok).toBe(false)
  })

  it.each([1, 4, 11.4, 13])('pause at %s seconds freezes every pose and timer, then resumes exactly', (elapsed) => {
    const { controller: c, model } = setup()
    c.dispatch({ type: 'start', targetLevel: 'level-6' }); c.advance(elapsed)
    c.dispatch({ type: 'pause' })
    const frozenState = c.getState(), frozenPose = c.getPose()
    c.advance(30)
    expect(c.getState()).toBe(frozenState); expect(c.getPose()).toBe(frozenPose)
    c.dispatch({ type: 'resume' }); c.advance(0.5)
    const expected = state(advanceSimulation(model, { ...frozenState, paused: false }, 0.5))
    expect(c.getState()).toEqual(expected)
  })

  it('reset restores initial level, closed doors, inverse assembly pose and zero rotation without planning writes', () => {
    const { controller: c, configuration } = setup(10)
    const store = createProjectStore(), project = store.getState().project
    const before = JSON.stringify(configuration), initial = c.getPose()
    c.dispatch({ type: 'start', targetLevel: 'level-10' }); c.advance(6); c.dispatch({ type: 'pause' }); c.dispatch({ type: 'reset' })
    expect(c.getPose()).toEqual(initial)
    expect(c.getState()).toMatchObject({ phase: 'idle', currentLevel: 'level-1', paused: false, doorProgress: 0, travelProgress: 0 })
    expect(JSON.stringify(configuration)).toBe(before)
    expect(store.getState().project).toBe(project)
    expect('timing' in store.getState().project.configuration).toBe(false)
  })

  it('is deterministic across clock partitions, has smooth bounded interpolation and finite poses', () => {
    const { model } = setup()
    const initial = state(dispatchSimulationCommand(model, createInitialSimulationState(model), { type: 'start', targetLevel: 'level-6' }))
    const one = state(advanceSimulation(model, initial, 11.5))
    let many = initial
    for (let n = 0; n < 115; n++) many = state(advanceSimulation(model, many, 0.1))
    expect(many.phase).toBe(one.phase)
    expect(many.phaseElapsedSeconds).toBeCloseTo(one.phaseElapsedSeconds)
    expect(many.doorProgress).toBeCloseTo(one.doorProgress)
    expect(smoothVisualizationProgress(-1)).toBe(0); expect(smoothVisualizationProgress(2)).toBe(1)
    expect(smoothVisualizationProgress(0.001)).toBeLessThan(0.001)
    const pose = createSimulationPose(model, many)
    expect(validateSimulationPose(model, pose)).toEqual([])
    expect(validateSimulationPose(model, { ...pose, cabinY: metres(NaN) })).toEqual(expect.arrayContaining([{ code: 'non-finite-pose', path: 'pose' }]))
  })

  it('notifies UI on phase transitions and commands rather than every animation frame', () => {
    const { controller: c } = setup(), listener = vi.fn()
    const unsubscribe = c.subscribe(listener)
    c.dispatch({ type: 'start', targetLevel: 'level-6' })
    const snapshot = c.getSnapshot()
    for (let n = 0; n < 60; n++) c.advance(1 / 60)
    expect(c.getSnapshot()).toBe(snapshot); expect(listener).toHaveBeenCalledTimes(1)
    c.advance(1.01)
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe(); c.dispatch({ type: 'reset' }); expect(listener).toHaveBeenCalledTimes(2)
  })

  it('rejects an invalid command without interrupting valid travel; clock faults freeze until reset', () => {
    const { controller: c } = setup()
    c.dispatch({ type: 'start', targetLevel: 'level-6' }); c.advance(3)
    expect(c.dispatch({ type: 'start', targetLevel: 'missing' }).ok).toBe(false)
    const progress = c.getPose().travelProgress
    c.advance(1)
    expect(c.getPose().travelProgress).toBeGreaterThan(progress)
    c.advance(NaN)
    const frozen = c.getPose()
    c.advance(20)
    expect(c.getPose()).toBe(frozen)
    c.dispatch({ type: 'reset' })
    expect(c.getState().phase).toBe('idle')
    expect(c.getSnapshot().issues).toEqual([])
  })

  it('uses built-in visual timing and degrades unsupported or stale optional suspension routes', () => {
    const { inputs } = setup()
    expect(createPassengerSimulationModel(inputs)).toMatchObject({ status: 'available', model: { timing: { source: 'visualization' } } })
    const invalid: PassengerVisualizationData = { ...PASSENGER_SIMULATION_DEMO_DATA, timing: { ...PASSENGER_SIMULATION_DEMO_DATA.timing!, doorClosingSeconds: 0 } }
    expect(createPassengerSimulationModel(inputs, invalid)).toMatchObject({ status: 'invalid', issues: [{ code: 'invalid-timing', path: 'visualization.timing' }] })
    expect(createPassengerSimulationModel({ ...inputs, drive: { ...inputs.drive, suspension: { ...inputs.drive.suspension!, ratio: '2:1' } } }, PASSENGER_SIMULATION_DEMO_DATA)).toMatchObject({
      status: 'available', availability: 'partial', model: { capabilities: { cabinMovement: { available: true }, suspensionUpdate: { available: false } } },
    })
    expect(createPassengerSimulationModel(normalize(createPassengerMechanicalFixture()), PASSENGER_SIMULATION_DEMO_DATA)).toMatchObject({
      status: 'available', availability: 'complete',
    })
  })

  it('enables basic cabin travel for a normal project without demo mechanical data', () => {
    const configuration = normalConfiguration()
    const result = createPassengerSimulationModel(normalize(configuration))
    expect(result.status).toBe('available')
    if (result.status !== 'available') throw new Error('Expected normal project simulation')
    expect(result.availability).toBe('partial')
    expect(result.model.capabilities).toMatchObject({
      cabinMovement: { available: true },
      counterweightMovement: { available: false },
      doorMovement: { available: false },
      tractionRotation: { available: false },
      suspensionUpdate: { available: false },
      governorUpdate: { available: false },
    })
    expect(configuration.mechanical).toBeUndefined()
    const controller = createPassengerSimulationController(result.model)
    expect(controller.dispatch({ type: 'start', targetLevel: 'level-6' }).ok).toBe(true)
    controller.advance(controller.getState().travelDurationSeconds + result.model.timing.arrivalSeconds)
    expect(controller.getState()).toMatchObject({ phase: 'idle', currentLevel: 'level-6' })
    expect(controller.getPose().cabinY).toBe(result.model.levels[5].elevationY)
    expect(controller.getPose().counterweightY).toBeUndefined()
    controller.dispatch({ type: 'reset' })
    expect(controller.getState().currentLevel).toBe('level-1')
  })

  it('enables panel motion without requiring detailed operator animation', () => {
    const demoDoors = createPassengerDoorDemo(false)
    const configuration: PassengerPlanningConfiguration = {
      ...normalConfiguration(),
      doors: {
        cabin: demoDoors.cabin?.map((entry) => ({
          source: entry.source, reference: entry.reference, id: entry.id, side: entry.side,
          axisXMm: entry.axisXMm, opening: entry.opening, assembly: entry.assembly,
        })),
        landings: demoDoors.landings?.map((entry) => ({
          source: entry.source, reference: entry.reference, id: entry.id,
          cabinEntranceId: entry.cabinEntranceId, side: entry.side,
          separationMm: entry.separationMm, opening: entry.opening, assembly: entry.assembly,
          overrides: entry.overrides,
        })),
      },
    }
    const result = createPassengerSimulationModel(normalize(configuration))
    expect(result.status).toBe('available')
    if (result.status !== 'available') throw new Error('Expected door-capable simulation')
    expect(result.model.capabilities).toMatchObject({ cabinMovement: { available: true }, doorMovement: { available: true } })
    const controller = createPassengerSimulationController(result.model)
    controller.dispatch({ type: 'start', targetLevel: 'level-6' })
    controller.advance(result.model.timing.doorClosingSeconds + controller.getState().travelDurationSeconds +
      result.model.timing.arrivalSeconds + result.model.timing.doorOpeningSeconds / 2)
    expect(controller.getPose()).toMatchObject({ simulationState: 'door-opening', activeLandingLevel: 'level-6' })
    expect(controller.getPose().cabinDoorProgress).toBeGreaterThan(0)
  })

  it('enables every visualization capability for the complete fixture through the shared engine', () => {
    const fixture = createPassengerSimulationFixture()
    const configuration: PassengerPlanningConfiguration = {
      ...fixture,
      mechanical: {
        ...fixture.mechanical,
        counterweightOffsetMm: {
          ...fixture.mechanical?.counterweightOffsetMm,
          xMm: fixture.mechanical!.counterweightOffsetMm!.xMm!,
          yMm: millimetres(3000),
          zMm: fixture.mechanical!.counterweightOffsetMm!.zMm!,
        },
      },
    }
    const result = createPassengerSimulationModel(normalize(configuration))
    expect(result).toMatchObject({
      status: 'available',
      availability: 'complete',
      model: { capabilities: Object.fromEntries([
        'cabinMovement', 'counterweightMovement', 'doorMovement', 'tractionRotation', 'suspensionUpdate', 'governorUpdate',
      ].map((name) => [name, { available: true }])) },
    })
    expect(createPassengerSimulationModel(normalize(fixture), PASSENGER_SIMULATION_DEMO_DATA)).toMatchObject({
      status: 'available', availability: 'complete',
    })
  })

  it('returns structured basic requirements when level or travel geometry is missing', () => {
    const result = createPassengerSimulationModel(normalize({
      ...normalConfiguration(), stopCount: undefined, floorHeightMm: undefined,
    }))
    expect(result).toMatchObject({ status: 'unavailable', issues: expect.arrayContaining([
      { code: 'unavailable-data', path: 'levels' },
      { code: 'unavailable-data', path: 'cabin.travelEnvelope' },
    ]) })
  })

  it.each([2, 6, 10])('travels both directions in a %i-stop normal project without optional mechanics', (count) => {
    const result = createPassengerSimulationModel(normalize(normalConfiguration(count)))
    if (result.status !== 'available') throw new Error(JSON.stringify(result))
    const controller = createPassengerSimulationController(result.model)
    const top = result.model.levels.at(-1)!
    controller.dispatch({ type: 'start', targetLevel: top.id })
    controller.advance(controller.getState().travelDurationSeconds + result.model.timing.arrivalSeconds)
    expect(controller.getPose().cabinY).toBe(top.elevationY)
    controller.dispatch({ type: 'start', targetLevel: 'level-1' })
    controller.advance(controller.getState().travelDurationSeconds + result.model.timing.arrivalSeconds)
    expect(controller.getPose().cabinY).toBe(result.model.levels[0].elevationY)
  })

  it('keeps the visualization profile outside technical project data', () => {
    const configuration = normalConfiguration()
    const before = JSON.stringify(configuration)
    const result = createPassengerSimulationModel(normalize(configuration))
    expect(result).toMatchObject({ status: 'available', model: { timing: PASSENGER_VISUALIZATION_TIMING } })
    expect(JSON.stringify(configuration)).toBe(before)
    expect(JSON.parse(before)).not.toHaveProperty('timing')
    expect(PASSENGER_VISUALIZATION_TIMING.source).toBe('visualization')
  })

  it('samples the moving cabin while preserving installation, mechanics, section and fixed drive frames', () => {
    const { inputs, controller: c } = setup(10)
    c.dispatch({ type: 'start', targetLevel: 'level-10' }); c.advance(6)
    for (const mode of ['overview', 'cabin', 'drive', 'mechanical', 'cutaway'] as const) {
      const original = getPassengerCameraFrame(mode, inputs.installation, inputs.components, inputs.drive, inputs.safety, inputs.doors)
      const framed = getPassengerSimulationCameraFrame(mode, original, inputs, c.getPose())
      if (mode !== 'cabin') expect(framed).toBe(original)
      else {
        expect(framed.target[1]).toBeGreaterThan(original.target[1])
        expect(framed.bounds.height).toBeLessThan(inputs.installation.bounds.height)
      }
    }
  })
})
