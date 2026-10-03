import { describe, expect, it } from 'vitest'
import {
  LIFT_FAMILIES,
  createPassengerPlanningConfiguration,
  updatePassengerPlanningConfiguration,
  type PassengerPlanningConfigurationUpdate,
} from '../../../elevator'
import {
  kilograms,
  metresPerSecond,
  millimetres,
} from '../../../engineering'
import { createLiftGeometryPlanningInput } from '../lift-geometry-planning-input'
import { getPassengerViewVisibility } from '../../scene/view-mode'
import {
  createPassengerInstallationModel,
  createUniformLevelElevations,
  type PassengerInstallationModel,
  type PassengerInstallationModelResult,
} from './passenger-installation-model'

function createPlanningInput(update: PassengerPlanningConfigurationUpdate = {}) {
  const configuration = updatePassengerPlanningConfiguration(
    createPassengerPlanningConfiguration('3D-Testprojekt'),
    update,
  )
  const planningInput = createLiftGeometryPlanningInput(configuration)

  if (!planningInput) {
    throw new Error('Expected a passenger geometry planning input.')
  }

  return planningInput
}

function getRenderedModel(
  result: PassengerInstallationModelResult,
): PassengerInstallationModel {
  if (!('model' in result) || !result.model) {
    throw new Error('Expected renderable passenger geometry.')
  }

  return result.model
}

function createCompletePlanningInput(throughCar = false) {
  return createPlanningInput({
    stopCount: 3,
    cabinWidthMm: millimetres(1100),
    cabinDepthMm: millimetres(1400),
    cabinHeightMm: millimetres(2200),
    doorWidthMm: millimetres(900),
    doorHeightMm: millimetres(2100),
    shaftWidthMm: millimetres(1800),
    shaftDepthMm: millimetres(2000),
    floorHeightMm: millimetres(3000),
    pitDepthMm: millimetres(1200),
    headroomMm: millimetres(3600),
    throughCar,
    counterweightWidthMm: millimetres(700),
    counterweightHeightMm: millimetres(1800),
    counterweightDepthMm: millimetres(220),
    counterweightPosition: 'rear',
  })
}

describe('passenger geometry planning', () => {
  it('maps millimetre configuration into the normalized planning contract', () => {
    const input = createCompletePlanningInput()

    expect(input.liftFamily).toBe(LIFT_FAMILIES.passenger)
    expect(input.cabin.widthMm).toBe(1100)
    expect(input.cabin.doorWidthMm).toBe(900)
    expect(input.shaft.widthMm).toBe(1800)
    expect(input.levels).toMatchObject({
      kind: 'uniform',
      stopCount: 3,
      floorHeightMm: 3000,
    })
  })

  it('returns an empty state for an empty configuration', () => {
    const result = createPassengerInstallationModel(createPlanningInput())

    expect(result.status).toBe('empty')
    expect(result).not.toHaveProperty('model')
    expect(result.missingFields).toContain('cabin.widthMm')
  })

  it('renders a cabin-only partial configuration', () => {
    const result = createPassengerInstallationModel(
      createPlanningInput({
        cabinWidthMm: millimetres(1100),
        cabinDepthMm: millimetres(1400),
        cabinHeightMm: millimetres(2200),
      }),
    )
    const model = getRenderedModel(result)

    expect(result.status).toBe('partial')
    expect(model.cabin).toMatchObject({
      width: 1.1,
      depth: 1.4,
      height: 2.2,
    })
    expect(model.cabin?.entrances).toEqual([])
    expect(model.shaft).toBeUndefined()
  })

  it('creates a front entrance with two correctly dimensioned door leaves', () => {
    const result = createPassengerInstallationModel(
      createPlanningInput({
        capacityKg: kilograms(630),
        passengerCount: 8,
        stopCount: 6,
        ratedSpeedMetresPerSecond: metresPerSecond(1),
        cabinWidthMm: millimetres(1100),
        cabinDepthMm: millimetres(1400),
        cabinHeightMm: millimetres(2200),
        doorWidthMm: millimetres(900),
        doorHeightMm: millimetres(2100),
      }),
    )
    const model = getRenderedModel(result)
    const frontEntrance = model.cabin?.entrances.find(
      (entrance) => entrance.side === 'front',
    )

    expect(result.status).toBe('partial')
    expect(frontEntrance).toMatchObject({ width: 0.9, height: 2.1 })
    expect(frontEntrance?.doorLeaves).toHaveLength(2)
    expect(frontEntrance?.doorLeaves).toEqual([
      expect.objectContaining({ position: 'left', width: 0.45, height: 2.1 }),
      expect.objectContaining({ position: 'right', width: 0.45, height: 2.1 }),
    ])
    expect(model.shaft).toBeUndefined()
    expect(model.levels).toEqual([])
  })

  it('creates a shaft only when both shaft dimensions exist', () => {
    const widthOnly = createPassengerInstallationModel(
      createPlanningInput({ shaftWidthMm: millimetres(1800) }),
    )
    const completeFootprint = createPassengerInstallationModel(
      createPlanningInput({
        shaftWidthMm: millimetres(1800),
        shaftDepthMm: millimetres(2000),
      }),
    )

    expect(widthOnly.status).toBe('empty')
    expect(getRenderedModel(completeFootprint).shaft).toMatchObject({
      width: 1.8,
      depth: 2,
    })
    expect(
      getRenderedModel(completeFootprint).shaft?.verticalExtent,
    ).toBeUndefined()
  })

  it('creates levels only when stop count and storey height exist', () => {
    const stopCountOnly = createPassengerInstallationModel(
      createPlanningInput({ stopCount: 6 }),
    )
    const completeLevels = createPassengerInstallationModel(
      createPlanningInput({
        stopCount: 6,
        floorHeightMm: millimetres(3000),
      }),
    )

    expect(stopCountOnly.status).toBe('empty')
    expect(
      getRenderedModel(completeLevels).levels.map((level) => level.elevationY),
    ).toEqual([0, 3, 6, 9, 12, 15])
  })

  it('creates complete geometry with converted dimensions and extents', () => {
    const result = createPassengerInstallationModel(
      createCompletePlanningInput(),
    )
    const model = getRenderedModel(result)

    expect(result.status).toBe('complete')
    expect(model.cabin).toMatchObject({
      width: 1.1,
      depth: 1.4,
      height: 2.2,
      rearWall: 'closed',
      throughCar: false,
    })
    expect(model.cabin?.entrances).toHaveLength(1)
    expect(model.cabin?.entrances[0]).toMatchObject({
      side: 'front',
      width: 0.9,
      height: 2.1,
    })
    expect(model.levels.map((level) => level.elevationY)).toEqual([0, 3, 6])
    expect(model.shaft?.verticalExtent).toMatchObject({
      bottomY: -1.2,
      topY: 9.6,
    })
    expect(model.shaft?.verticalExtent?.height).toBeCloseTo(10.8)
    expect(model.pit?.height).toBe(1.2)
    // Mechanical placement is resolved separately from the installation envelope.
    expect(model).not.toHaveProperty('counterweight')
  })

  it('keeps a closed rear wall when through-car is disabled', () => {
    const model = getRenderedModel(
      createPassengerInstallationModel(createCompletePlanningInput(false)),
    )

    expect(model.cabin?.rearWall).toBe('closed')
    expect(model.cabin?.entrances.map((entrance) => entrance.side)).toEqual([
      'front',
    ])
  })

  it('creates a rear entrance when through-car is enabled', () => {
    const result = createPassengerInstallationModel(
      createCompletePlanningInput(true),
    )
    const cabin = getRenderedModel(result).cabin

    expect(cabin?.rearWall).toBe('opening')
    expect(cabin?.entrances.map((entrance) => entrance.side)).toEqual([
      'front',
      'rear',
    ])
    expect(cabin?.entrances[1]?.doorLeaves).toHaveLength(2)
  })

  it('changes obstructing-surface visibility in cutaway mode', () => {
    const overview = getPassengerViewVisibility('overview')
    const cutaway = getPassengerViewVisibility('cutaway')

    expect(overview.showRightCabinWall).toBe(true)
    expect(overview.showFrontWallSections).toBe(true)
    expect(overview.frontDoorOpacity).toBe(1)
    expect(cutaway.showRightCabinWall).toBe(false)
    expect(cutaway.showFrontWallSections).toBe(false)
    expect(cutaway.frontDoorOpacity).toBeLessThan(1)
    expect(cutaway.shaftEnvelopeOpacity).toBe(0)
  })

  it('keeps valid cabin geometry visible when door dimensions are invalid', () => {
    const result = createPassengerInstallationModel(
      createPlanningInput({
        cabinWidthMm: millimetres(1100),
        cabinDepthMm: millimetres(1400),
        cabinHeightMm: millimetres(2200),
        doorWidthMm: millimetres(1200),
        doorHeightMm: millimetres(2100),
      }),
    )
    const model = getRenderedModel(result)

    expect(result.status).toBe('invalid')
    expect(model.cabin).toBeDefined()
    expect(model.cabin?.entrances).toEqual([])
  })

  it('generates uniform level elevations through centralized unit conversion', () => {
    expect(createUniformLevelElevations(4, millimetres(2500))).toEqual([
      0, 2.5, 5, 7.5,
    ])
  })
})
