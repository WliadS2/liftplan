import { describe, expect, it } from 'vitest'
import {
  createPassengerPlanningConfiguration,
  type PassengerPlanningConfiguration,
} from '../elevator'
import { metres, millimetres } from '../engineering'
import { createPassengerDoorDemo } from '../dev/fixtures/passenger-door-demo'
import { createPassengerMechanicalFixture } from '../dev/fixtures/passenger-mechanical-fixture'
import { createPassengerSimulationFixture, PASSENGER_SIMULATION_DEMO_DATA } from '../dev/fixtures/passenger-simulation-demo'
import { createLiftGeometryPlanningInput } from '../three/geometry/lift-geometry-planning-input'
import { createPassengerInstallationModel } from '../three/geometry/passenger/passenger-installation-model'
import { createPassengerMechanicalLayout } from '../three/geometry/passenger/mechanical/passenger-mechanical-layout'
import { createPassengerMechanicalComponents } from '../three/geometry/passenger/mechanical/mechanical-component-model'
import { createTractionDriveModel } from '../three/geometry/passenger/mechanical/traction-drive-model'
import { createPassengerSafetyModel } from '../three/geometry/passenger/mechanical/passenger-safety-model'
import { createPassengerDoorSystem } from '../three/geometry/passenger/doors/passenger-door-model'
import { createPassengerSimulationModel } from '../simulation/passenger-simulation-model'
import {
  aabbContains,
  aabbIntersects,
  aabbOutside,
  aabbSeparation,
  classifyAabbIntersection,
  createVerticalSweptAabb,
  measureGeometricClearances,
  type AxisAlignedBoundingBox,
} from './spatial-primitives'
import type { PassengerSpatialGeometryInputs, SpatialEnvelope } from './passenger-spatial-envelopes'
import {
  PASSENGER_SPATIAL_RULES,
  validatePassengerSpatialGeometry,
} from './passenger-spatial-validation'

function normalConfiguration(stopCount = 2): PassengerPlanningConfiguration {
  return {
    ...createPassengerPlanningConfiguration('Räumliche Prüfung'),
    stopCount,
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

function normalize(configuration: PassengerPlanningConfiguration): PassengerSpatialGeometryInputs {
  const planning = createLiftGeometryPlanningInput(configuration)!
  const installationResult = createPassengerInstallationModel(planning)
  if (!('model' in installationResult) || !installationResult.model) throw new Error('Expected installation model')
  const installation = installationResult.model
  const layout = createPassengerMechanicalLayout(planning, installation)
  const components = createPassengerMechanicalComponents(planning.mechanical.components, layout)
  const drive = createTractionDriveModel(planning.mechanical.drive, installation, layout, components)
  const safety = createPassengerSafetyModel(planning.mechanical.safety, installation, layout, components, drive.machine)
  const doors = createPassengerDoorSystem(planning.doors, installation)
  return { planning, installation, layout, components, drive, safety, doors }
}

function evaluation(inputs: PassengerSpatialGeometryInputs, id: string, motion = {}) {
  const found = validatePassengerSpatialGeometry(inputs, motion).results.find((entry) => entry.ruleId === id)
  if (!found) throw new Error(`Missing rule ${id}`)
  return found
}

const box = (min: [number, number, number], max: [number, number, number]): AxisAlignedBoundingBox => ({
  min: min.map(metres) as unknown as AxisAlignedBoundingBox['min'],
  max: max.map(metres) as unknown as AxisAlignedBoundingBox['max'],
})

describe('static collision primitives', () => {
  it('answers intersection, containment, outside, and deterministic separation without tolerances', () => {
    const outer = box([0, 0, 0], [10, 10, 10])
    const inner = box([2, 3, 4], [8, 9, 6])
    const separate = box([12, 3, 4], [13, 5, 6])
    expect(aabbContains(outer, inner)).toBe(true)
    expect(aabbOutside(outer, separate)).toBe(true)
    expect(aabbIntersects(outer, inner)).toBe(true)
    expect(aabbIntersects(outer, separate)).toBe(false)
    expect(aabbSeparation(outer, separate)).toEqual({ x: 2, y: 0, z: 0, distance: 2 })
  })

  it('reports raw six-direction geometric clearances', () => {
    const clearances = measureGeometricClearances(
      box([-1, -2, -1.1], [1, 5, 1.1]),
      box([-0.55, 0, -0.7], [0.55, 2.2, 0.7]),
    )
    expect(clearances.left).toBeCloseTo(0.45)
    expect(clearances.right).toBeCloseTo(0.45)
    expect(clearances.front).toBeCloseTo(0.4)
    expect(clearances.rear).toBeCloseTo(0.4)
    expect(clearances.top).toBeCloseTo(2.8)
    expect(clearances.bottom).toBeCloseTo(2)
  })

  it('creates an analytic vertical swept envelope', () => {
    expect(createVerticalSweptAabb(box([-0.5, 0, -0.5], [0.5, 2, 0.5]), metres(-1), metres(9))).toEqual(
      box([-0.5, -1, -0.5], [0.5, 11, 0.5]),
    )
  })

  it('classifies touching AABBs as contact rather than penetration', () => {
    const first = box([0, 0, 0], [1, 1, 1])
    const touching = box([1, 0.25, 0.25], [2, 0.75, 0.75])
    expect(classifyAabbIntersection(first, touching)).toEqual({
      relationship: 'contact', overlap: [0, 0.5, 0.5],
    })
    expect(aabbIntersects(first, touching)).toBe(false)
  })
})

describe('passenger spatial rule registry', () => {
  it('contains only geometric rules in this increment', () => {
    expect(new Set(PASSENGER_SPATIAL_RULES.map((rule) => rule.id)).size).toBe(PASSENGER_SPATIAL_RULES.length)
    expect(PASSENGER_SPATIAL_RULES.every((rule) => rule.source === 'geometric' && rule.requiredData.length > 0)).toBe(true)
  })

  it('accepts a cabin clearly inside a larger shaft and valid ordered levels', () => {
    const inputs = normalize(normalConfiguration(6))
    expect(evaluation(inputs, 'passenger.cabin.shaft-fit')).toMatchObject({ status: 'ok' })
    expect(evaluation(inputs, 'passenger.levels.structure')).toMatchObject({ status: 'ok' })
  })

  it.each([
    ['width', { shaftWidthMm: millimetres(1000) }],
    ['depth', { shaftDepthMm: millimetres(1300) }],
  ] as const)('rejects a cabin outside the explicit shaft by %s', (_dimension, update) => {
    const rule = evaluation(normalize({ ...normalConfiguration(), ...update }), 'passenger.cabin.shaft-fit')
    expect(rule.status).toBe('invalid')
    expect(rule.issues).toContainEqual(expect.objectContaining({ code: 'cabin-outside-shaft', blocksCabinTravel: true }))
  })

  it('returns deterministic left/right/front/rear clearances', () => {
    const clearances = evaluation(normalize(normalConfiguration()), 'passenger.cabin.shaft-fit').clearances!
    expect(clearances.left).toBeCloseTo(0.45)
    expect(clearances.right).toBeCloseTo(0.45)
    expect(clearances.front).toBeCloseTo(0.4)
    expect(clearances.rear).toBeCloseTo(0.4)
  })

  it('reports counterweight outside-shaft and cabin intersection from explicit layouts', () => {
    const fixture = createPassengerMechanicalFixture()
    const outside = normalize({ ...fixture, mechanical: { ...fixture.mechanical,
      counterweightOffsetMm: { xMm: millimetres(0), yMm: millimetres(0), zMm: millimetres(-2000) },
    } })
    expect(evaluation(outside, 'passenger.counterweight.static-fit').issues[0].code).toBe('counterweight-outside-shaft')
    const crossing = normalize({ ...fixture, mechanical: { ...fixture.mechanical,
      counterweightOffsetMm: { xMm: millimetres(0), yMm: millimetres(0), zMm: millimetres(-600) },
    } })
    expect(evaluation(crossing, 'passenger.counterweight.static-fit').issues[0].code).toBe('counterweight-cabin-intersection')
  })

  it('accepts separated explicit cabin and counterweight envelopes', () => {
    expect(evaluation(normalize(createPassengerSimulationFixture()), 'passenger.counterweight.static-fit')).toMatchObject({
      status: 'ok', issues: [],
    })
  })

  it('reports a collapsed explicit rail pair', () => {
    const fixture = createPassengerMechanicalFixture()
    const inputs = normalize({ ...fixture, mechanical: { ...fixture.mechanical, carRailPositionsMm: [
      { xMm: millimetres(700), zMm: millimetres(0) },
      { xMm: millimetres(700), zMm: millimetres(0) },
    ] } })
    expect(evaluation(inputs, 'passenger.rails.structure')).toMatchObject({
      status: 'invalid', issues: [expect.objectContaining({ code: 'collapsed-rail-pair' })],
    })
  })

  it('reports a landing-door reference to an invalid level', () => {
    const fixture = createPassengerMechanicalFixture()
    const series = fixture.doors!.landings![0]
    const inputs = normalize({ ...fixture, doors: { ...fixture.doors,
      landings: [{ ...series, overrides: [{ levelId: 'level-99' }] }],
    } })
    expect(evaluation(inputs, 'passenger.doors.structure')).toMatchObject({
      status: 'invalid', issues: [expect.objectContaining({ code: 'invalid-landing-level' })],
    })
  })

  it('rejects an explicit cabin-door opening that does not fit the cabin entrance', () => {
    const fixture = createPassengerMechanicalFixture()
    const cabinDoor = fixture.doors!.cabin![0]
    const inputs = normalize({ ...fixture, doors: { ...fixture.doors,
      cabin: [{ ...cabinDoor, opening: { widthMm: millimetres(1200), heightMm: millimetres(2100) } }],
    } })
    const doorRule = evaluation(inputs, 'passenger.doors.structure')
    expect(doorRule.status).toBe('invalid')
    expect(doorRule.issues).toContainEqual(expect.objectContaining({ code: 'door-width-exceeds-cabin-entrance' }))
    expect(doorRule.issues).not.toContainEqual(
      expect.objectContaining({ code: 'missing-cabin-entrance' }),
    )
  })

  it('distinguishes door-height fit from an actually missing cabin entrance', () => {
    const fixture = createPassengerMechanicalFixture()
    const heightInputs = normalize({ ...fixture, doorHeightMm: millimetres(2300) })
    const heightRule = evaluation(heightInputs, 'passenger.doors.structure')
    expect(heightRule.issues).toContainEqual(expect.objectContaining({ code: 'door-height-exceeds-cabin-entrance' }))
    expect(heightRule.issues).not.toContainEqual(expect.objectContaining({ code: 'missing-cabin-entrance' }))

    const landingSeries = fixture.doors!.landings![0]
    const missingInputs = normalize({ ...fixture, doors: { ...fixture.doors,
      landings: [{ ...landingSeries, cabinEntranceId: 'missing-cabin-entrance' }],
    } })
    expect(evaluation(missingInputs, 'passenger.doors.structure')).toMatchObject({
      status: 'invalid',
      issues: [expect.objectContaining({ code: 'missing-cabin-entrance' })],
    })
  })

  it('returns UNKNOWN rather than INVALID for absent shaft, counterweight, and landing doors', () => {
    const noShaft = normalize({ ...normalConfiguration(), shaftWidthMm: undefined, shaftDepthMm: undefined })
    expect(evaluation(noShaft, 'passenger.cabin.shaft-fit')).toMatchObject({ status: 'unknown' })
    expect(evaluation(normalize(normalConfiguration()), 'passenger.counterweight.static-fit')).toMatchObject({ status: 'unknown' })
    const demoDoors = createPassengerDoorDemo(false)
    const cabinOnly = normalize({ ...normalConfiguration(), doors: { cabin: demoDoors.cabin } })
    expect(evaluation(cabinOnly, 'passenger.doors.structure')).toMatchObject({
      status: 'unknown', issues: [expect.objectContaining({ code: 'landing-door-data-unavailable' })],
    })
  })

  it.each([2, 6, 10])('derives the cabin swept envelope for %i stops', (count) => {
    const validation = validatePassengerSpatialGeometry(normalize(normalConfiguration(count)))
    expect(validation.envelopes.cabinSweep?.bounds).toMatchObject({ min: [-0.55, 0, -0.7], max: [0.55, (count - 1) * 3 + 2.2, 0.7] })
  })

  it('derives a counterweight swept envelope from an explicit centre envelope', () => {
    const inputs = normalize(createPassengerSimulationFixture())
    const validation = validatePassengerSpatialGeometry(inputs, {
      counterweightCenterEnvelope: { minY: metres(1.1), maxY: metres(4.1) },
    })
    expect(validation.envelopes.counterweightSweep?.bounds?.min[1]).toBeCloseTo(0.2)
    expect(validation.envelopes.counterweightSweep?.bounds?.max[1]).toBeCloseTo(5)
  })

  it('rejects an explicit counterweight sweep outside the known shaft', () => {
    const inputs = normalize(createPassengerSimulationFixture())
    expect(evaluation(inputs, 'passenger.counterweight.static-fit', {
      counterweightCenterEnvelope: { minY: metres(-5), maxY: metres(30) },
    })).toMatchObject({
      status: 'invalid',
      issues: [expect.objectContaining({ code: 'counterweight-travel-outside-shaft', blocksCabinTravel: true })],
    })
  })

  it('detects a fixed obstacle in the analytic cabin sweep', () => {
    const obstacleBounds = box([-0.2, 4, -0.2], [0.2, 5, 0.2])
    const obstacle: SpatialEnvelope = {
      id: 'test-obstacle', subsystem: 'traction', componentIds: ['test-obstacle'], bounds: obstacleBounds,
      plan: { minX: metres(-0.2), maxX: metres(0.2), minZ: metres(-0.2), maxZ: metres(0.2) },
    }
    expect(evaluation(normalize(normalConfiguration(6)), 'passenger.movement.swept-spaces', {
      fixedObstacles: [obstacle],
    })).toMatchObject({
      status: 'invalid', issues: [expect.objectContaining({ code: 'fixed-obstacle-in-cabin-sweep', blocksCabinTravel: true })],
    })
  })

  it('keeps the complete Mechanical Demo free of false blocking swept-space conflicts', () => {
    const configuration = createPassengerMechanicalFixture()
    expect(configuration).toMatchObject({ doorWidthMm: millimetres(900), doorHeightMm: millimetres(2100) })
    const inputs = normalize(configuration)
    const movement = evaluation(inputs, 'passenger.movement.swept-spaces')
    expect(movement.issues).not.toContainEqual(expect.objectContaining({
      code: 'fixed-obstacle-in-cabin-sweep',
    }))
    expect(createPassengerSimulationModel(inputs).status).toBe('available')
  })

  it('does not report a cabin/counterweight conflict for overlapping Y travel with separated X/Z plans', () => {
    const inputs = normalize(createPassengerSimulationFixture())
    expect(evaluation(inputs, 'passenger.movement.swept-spaces', {
      counterweightCenterEnvelope: { minY: metres(1.1), maxY: metres(4.1) },
    })).toMatchObject({ status: 'ok', issues: [] })
  })

  it('invalidates actual cabin/counterweight swept penetration without inferring timing', () => {
    const inputs = normalize(createPassengerSimulationFixture())
    const overlappingLayout = {
      ...inputs.layout,
      counterweight: inputs.layout.counterweight && {
        ...inputs.layout.counterweight,
        bounds: { ...inputs.layout.counterweight.bounds,
          min: [metres(-0.2), inputs.layout.counterweight.bounds.min[1], metres(-0.2)] as const,
          max: [metres(0.2), inputs.layout.counterweight.bounds.max[1], metres(0.2)] as const,
        },
        center: [metres(0), inputs.layout.counterweight.center[1], metres(0)] as const,
      },
    }
    const sweep = evaluation({ ...inputs, layout: overlappingLayout }, 'passenger.movement.swept-spaces', {
      counterweightCenterEnvelope: { minY: metres(1.1), maxY: metres(4.1) },
    })
    expect(sweep).toMatchObject({
      status: 'invalid',
      issues: [expect.objectContaining({
        code: 'counterweight-sweep-conflict', severity: 'error', blocksCabinTravel: true,
      })],
    })
    expect(createPassengerSimulationModel({ ...inputs, layout: overlappingLayout }, PASSENGER_SIMULATION_DEMO_DATA)).toMatchObject({
      status: 'invalid',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'geometric-conflict', path: 'counterweight-sweep-conflict' }),
      ]),
    })
  })

  it('keeps fixed guide rails and landing doors out of moving sweeps', () => {
    const validation = validatePassengerSpatialGeometry(normalize(createPassengerSimulationFixture()), {
      counterweightCenterEnvelope: { minY: metres(1.1), maxY: metres(4.1) },
    })
    const carIds = [
      ...validation.envelopes.cabinSweep?.componentIds ?? [],
      ...validation.envelopes.carFrameSweep?.componentIds ?? [],
    ]
    expect(carIds.some((id) => id.startsWith('car-rail-') || id.startsWith('landing-'))).toBe(false)
    expect(validation.envelopes.counterweightSweep?.componentIds.some((id) =>
      id.startsWith('counterweight-rail-'))).toBe(false)
  })

  it.each([2, 6, 10])('keeps the complete Mechanical Demo swept-space baseline stable for %i stops', (count) => {
    const inputs = normalize(createPassengerSimulationFixture('rear', false, count))
    expect(evaluation(inputs, 'passenger.movement.swept-spaces').issues).not.toContainEqual(
      expect.objectContaining({ code: 'fixed-obstacle-in-cabin-sweep' }),
    )
    expect(createPassengerSimulationModel(inputs).status).toBe('available')
  })

  it('blocks simulation only for travel-blocking INVALID geometry', () => {
    const invalidInputs = normalize({ ...normalConfiguration(), shaftWidthMm: millimetres(1000) })
    expect(createPassengerSimulationModel(invalidInputs)).toMatchObject({
      status: 'invalid', issues: [expect.objectContaining({ code: 'geometric-conflict', path: 'cabin-outside-shaft' })],
    })

    const warningInputs = normalize({ ...normalConfiguration(), shaftWidthMm: millimetres(1100) })
    expect(evaluation(warningInputs, 'passenger.cabin.shaft-fit')).toMatchObject({ status: 'warning' })
    expect(createPassengerSimulationModel(warningInputs).status).toBe('available')

    const unknownInputs = normalize(normalConfiguration())
    expect(evaluation(unknownInputs, 'passenger.counterweight.static-fit')).toMatchObject({ status: 'unknown' })
    expect(createPassengerSimulationModel(unknownInputs).status).toBe('available')
  })

  it('does not turn an oversized demo door into a stale-reference simulation error', () => {
    const inputs = normalize({ ...createPassengerSimulationFixture(), doorWidthMm: millimetres(2300) })
    const doorRule = evaluation(inputs, 'passenger.doors.structure')
    expect(doorRule.issues).toContainEqual(expect.objectContaining({ code: 'door-width-exceeds-cabin-entrance' }))
    expect(doorRule.issues).not.toContainEqual(expect.objectContaining({ code: 'missing-cabin-entrance' }))
    expect(createPassengerSimulationModel(inputs)).toMatchObject({
      status: 'available',
      availability: 'partial',
      model: {
        capabilities: {
          cabinMovement: { available: true },
          doorMovement: { available: false },
        },
      },
    })
  })
})
