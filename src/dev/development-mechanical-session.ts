import { createPassengerMechanicalFixture } from './fixtures/passenger-mechanical-fixture'

export interface DevelopmentMechanicalProjectActions {
  updateConfiguration: (configuration: unknown) => unknown
  createProject: () => void
}

/**
 * Loads deliberately isolated demo data for local visual inspection only.
 * This module is imported exclusively by DEV-only UI code and tests.
 */
export function loadDevelopmentMechanicalFixture(
  actions: DevelopmentMechanicalProjectActions,
) {
  const configuration = createPassengerMechanicalFixture()
  actions.updateConfiguration(configuration)

  return configuration
}

export function resetDevelopmentMechanicalFixture(
  actions: DevelopmentMechanicalProjectActions,
) {
  actions.createProject()
}
