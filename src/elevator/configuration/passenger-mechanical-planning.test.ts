import { describe, expect, it } from 'vitest'
import { createPassengerPlanningConfiguration, passengerPlanningConfigurationSchema } from './passenger-planning-configuration'
import { passengerMechanicalPlanningSchema } from './passenger-mechanical-planning'
import { createProjectStore } from '../../projects/project-store'
import { createPassengerMechanicalFixture } from '../../dev/fixtures/passenger-mechanical-fixture'
import {
  loadDevelopmentMechanicalFixture,
  resetDevelopmentMechanicalFixture,
} from '../../dev/development-mechanical-session'

describe('passenger mechanical planning structure', () => {
  it('keeps partial planning input valid and preserves missing offset coordinates', () => {
    const parsed = passengerMechanicalPlanningSchema.parse({ counterweightOffsetMm: { xMm: 10 } })
    expect(parsed.counterweightOffsetMm).toEqual({ xMm: 10 })
    expect(parsed.counterweightOffsetMm?.yMm).toBeUndefined()
  })
  it('rejects non-finite positions, unknown keys and malformed rail pairs', () => {
    expect(passengerMechanicalPlanningSchema.safeParse({ counterweightOffsetMm: { xMm: Infinity } }).success).toBe(false)
    expect(passengerMechanicalPlanningSchema.safeParse({ balanceFactor: 0.5 }).success).toBe(false)
    expect(passengerMechanicalPlanningSchema.safeParse({ carRailPositionsMm: [{ xMm: 0, zMm: 0 }] }).success).toBe(false)
  })
  it('requires explicit component provenance and structurally complete component records', () => {
    const fixture = createPassengerMechanicalFixture()
    const profile = fixture.mechanical!.components!.railProfile!
    expect(passengerMechanicalPlanningSchema.safeParse({ components: { railProfile: profile } }).success).toBe(true)
    expect(passengerMechanicalPlanningSchema.safeParse({ components: { railProfile: { ...profile, source: undefined } } }).success).toBe(false)
    expect(passengerMechanicalPlanningSchema.safeParse({ components: { railProfile: { ...profile, source: 'standard' } } }).success).toBe(false)
    expect(passengerMechanicalPlanningSchema.safeParse({ components: { railProfile: { ...profile, headWidthMm: Infinity } } }).success).toBe(false)
  })
  it('round-trips fixture mechanical inputs through project state without creating defaults', () => {
    const store = createProjectStore()
    const fixture = createPassengerMechanicalFixture()
    store.getState().updateConfiguration(fixture)
    expect(store.getState().project.configuration).toMatchObject({ mechanical: fixture.mechanical, counterweightDepthMm: 220 })
    expect(passengerPlanningConfigurationSchema.safeParse(store.getState().project.configuration).success).toBe(true)
    store.getState().createProject()
    expect(store.getState().project.configuration).toEqual(createPassengerPlanningConfiguration('Neues LiftPlan-Projekt'))
  })

  it('loads and resets the development fixture without making it a project default', () => {
    const store = createProjectStore()
    const normalConfiguration = store.getState().project.configuration

    expect(normalConfiguration).toEqual(
      createPassengerPlanningConfiguration('Neues LiftPlan-Projekt'),
    )
    expect(
      passengerPlanningConfigurationSchema.parse(normalConfiguration).mechanical,
    ).toBeUndefined()

    const fixture = loadDevelopmentMechanicalFixture(store.getState())
    const loaded = store.getState().project

    expect(store.getState().persistenceMode).toBe('development-demo')
    expect(loaded.name).toBe('Mechanische Demo – Testdaten')
    expect(loaded.configuration).toMatchObject({
      mechanical: fixture.mechanical,
      counterweightDepthMm: fixture.counterweightDepthMm,
    })

    resetDevelopmentMechanicalFixture(store.getState())

    expect(store.getState().persistenceMode).toBe('project')
    expect(store.getState().project.configuration).toEqual(normalConfiguration)
    expect(
      passengerPlanningConfigurationSchema.parse(
        store.getState().project.configuration,
      ).mechanical,
    ).toBeUndefined()
  })
})
