import { describe, expect, it } from 'vitest'
import {
  LIFT_FAMILIES,
  createPassengerPlanningConfiguration,
  updatePassengerPlanningConfiguration,
} from '../../../elevator'
import { millimetres } from '../../../engineering'
import { createLiftGeometryPlanningInput } from '../lift-geometry-planning-input'
import {
  createPassengerInstallationModel,
  createUniformLevelElevations,
} from './passenger-installation-model'

function createCompletePlanningInput(throughCar = false) {
  const configuration = updatePassengerPlanningConfiguration(
    createPassengerPlanningConfiguration('3D-Testprojekt'),
    {
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
    },
  )

  const planningInput = createLiftGeometryPlanningInput(configuration)

  if (!planningInput) {
    throw new Error('Expected a passenger geometry planning input.')
  }

  return planningInput
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

  it('converts dimensions and generates one elevation per configured stop', () => {
    const result = createPassengerInstallationModel(
      createCompletePlanningInput(),
    )

    expect(result.status).toBe('ready')

    if (result.status !== 'ready') {
      return
    }

    expect(result.model.cabin).toMatchObject({
      width: 1.1,
      depth: 1.4,
      height: 2.2,
      doorWidth: 0.9,
      doorHeight: 2.1,
      throughCar: false,
    })
    expect(result.model.levels.map((level) => level.elevationY)).toEqual([
      0, 3, 6,
    ])
    expect(result.model.pit?.height).toBe(1.2)
    expect(result.model.counterweight).toMatchObject({
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

    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.model.cabin.throughCar).toBe(true)
    }
  })

  it('returns missing fields instead of inventing visualization dimensions', () => {
    const emptyConfiguration = createPassengerPlanningConfiguration(
      'Unvollständiges Testprojekt',
    )
    const input = createLiftGeometryPlanningInput(emptyConfiguration)

    expect(input).toBeDefined()
    if (!input) {
      return
    }

    const result = createPassengerInstallationModel(input)

    expect(result.status).toBe('incomplete')
    if (result.status === 'incomplete') {
      expect(result.missingFields).toContain('cabin.widthMm')
      expect(result.missingFields).toContain('levels.stopCount')
      expect(result.missingFields).toContain('shaft.widthMm')
    }
  })

  it('generates uniform level elevations through centralized unit conversion', () => {
    expect(createUniformLevelElevations(4, millimetres(2500))).toEqual([
      0, 2.5, 5, 7.5,
    ])
  })
})
