import { describe, expect, it } from 'vitest'
import {
  LIFT_FAMILIES,
  updatePassengerPlanningConfiguration,
} from '../elevator'
import { kilograms } from '../engineering'
import { createLiftPlanProject, createProjectStore } from './index'

const fixedTimestamp = '2026-10-03T12:00:00.000Z'

describe('LiftPlan projects', () => {
  it('creates a project with a passenger planning configuration', () => {
    const project = createLiftPlanProject(
      { projectName: 'Bauvorhaben Nord' },
      {
        createId: () => 'project-1',
        now: () => fixedTimestamp,
      },
    )

    expect(project).toMatchObject({
      id: 'project-1',
      name: 'Bauvorhaben Nord',
      liftFamily: LIFT_FAMILIES.passenger,
      createdAt: fixedTimestamp,
      updatedAt: fixedTimestamp,
    })
    expect(project.configuration).toMatchObject({
      family: LIFT_FAMILIES.passenger,
      projectName: 'Bauvorhaben Nord',
    })
  })

  it('updates a configuration through the Zustand project store', () => {
    const store = createProjectStore({
      createId: () => 'project-2',
      now: () => fixedTimestamp,
    })
    const currentConfiguration = store.getState().project.configuration

    if (currentConfiguration.family !== LIFT_FAMILIES.passenger) {
      throw new Error('Expected the initial project to use the passenger family.')
    }

    const nextConfiguration = updatePassengerPlanningConfiguration(
      currentConfiguration,
      { capacityKg: kilograms(630) },
    )
    const validation = store.getState().updateConfiguration(nextConfiguration)

    expect(validation.status).toBe('valid')
    expect(store.getState().project.configuration).toMatchObject({
      capacityKg: 630,
    })
  })
})
