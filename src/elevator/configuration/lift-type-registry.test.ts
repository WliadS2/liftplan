import { describe, expect, it } from 'vitest'
import {
  LIFT_FAMILIES,
  PASSENGER_PLANNING_SCHEMA_VERSION,
  getLiftTypeDefinition,
  getLiftTypeDefinitions,
  passengerPlanningConfigurationSchema,
  validateLiftConfiguration,
} from '../../elevator'

describe('lift type registry', () => {
  it('registers all target families and marks only implemented types as available', () => {
    const definitions = getLiftTypeDefinitions()

    expect(definitions).toHaveLength(8)
    expect(getLiftTypeDefinition(LIFT_FAMILIES.passenger).implementationStatus).toBe(
      'available',
    )
    expect(getLiftTypeDefinition(LIFT_FAMILIES.goods).implementationStatus).toBe(
      'available',
    )
    expect(getLiftTypeDefinition(LIFT_FAMILIES.car).implementationStatus).toBe('available')
  })

  it('structurally validates a passenger planning configuration', () => {
    const validConfiguration = {
      family: LIFT_FAMILIES.passenger,
      schemaVersion: PASSENGER_PLANNING_SCHEMA_VERSION,
      projectName: 'Testprojekt',
      capacityKg: 630,
      cabinWidthMm: 1100,
    }

    const parsed = passengerPlanningConfigurationSchema.safeParse(
      validConfiguration,
    )
    const validation = validateLiftConfiguration(validConfiguration)

    expect(parsed.success).toBe(true)
    expect(validation.status).toBe('valid')
    expect(validation.issues).toEqual([])
  })

  it('reports malformed configuration data as structured validation output', () => {
    const validation = validateLiftConfiguration({
      family: LIFT_FAMILIES.passenger,
      schemaVersion: PASSENGER_PLANNING_SCHEMA_VERSION,
      projectName: 'Testprojekt',
      cabinWidthMm: 'breit',
    })

    expect(validation.status).toBe('invalid')
    expect(validation.issues[0]).toMatchObject({
      messageKey: 'validation.configuration.invalid',
    })
  })
})
