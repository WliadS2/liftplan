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
    expect(model.cabin?.door).toBeUndefined()
    expect(model.shaft).toBeUndefined()
  })

  it('adds the door when cabin and door dimensions exist', () => {
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

    expect(result.status).toBe('partial')
    expect(model.cabin?.door).toEqual({ width: 0.9, height: 2.1 })
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
      door: { width: 0.9, height: 2.1 },
      throughCar: false,
    })
    expect(model.levels.map((level) => level.elevationY)).toEqual([0, 3, 6])
    expect(model.shaft?.verticalExtent).toMatchObject({
      bottomY: -1.2,
      topY: 9.6,
    })
    expect(model.shaft?.verticalExtent?.height).toBeCloseTo(10.8)
    expect(model.pit?.height).toBe(1.2)
    expect(model.counterweight).toMatchObject({
      width: 0.7,
      height: 1.8,
      center: [0, 0.9, -1],
      position: 'rear',
    })
  })

  it('preserves the through-car state for front and rear opening geometry', () => {
    const result = createPassengerInstallationModel(
      createCompletePlanningInput(true),
    )

    expect(getRenderedModel(result).cabin?.throughCar).toBe(true)
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
    expect(model.cabin?.door).toBeUndefined()
  })

  it('generates uniform level elevations through centralized unit conversion', () => {
    expect(createUniformLevelElevations(4, millimetres(2500))).toEqual([
      0, 2.5, 5, 7.5,
    ])
  })
})
