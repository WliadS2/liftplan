import { describe, expect, it } from 'vitest'
import { createPassengerPlanningConfiguration, passengerPlanningConfigurationSchema } from './passenger-planning-configuration'
import { passengerMechanicalPlanningSchema } from './passenger-mechanical-planning'
import { createProjectStore } from '../../projects/project-store'
import { createPassengerMechanicalFixture } from '../../dev/fixtures/passenger-mechanical-fixture'

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
  it('round-trips fixture mechanical inputs through project state without creating defaults', () => {
    const store = createProjectStore()
    const fixture = createPassengerMechanicalFixture()
    store.getState().updateConfiguration(fixture)
    expect(store.getState().project.configuration).toMatchObject({ mechanical: fixture.mechanical, counterweightDepthMm: 220 })
    expect(passengerPlanningConfigurationSchema.safeParse(store.getState().project.configuration).success).toBe(true)
    store.getState().createProject()
    expect(store.getState().project.configuration).toEqual(createPassengerPlanningConfiguration('Neues LiftPlan-Projekt'))
  })
})
