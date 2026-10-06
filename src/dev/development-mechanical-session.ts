import { createPassengerMechanicalFixture } from './fixtures/passenger-mechanical-fixture'
import { createGoodsLiftQaFixture } from './fixtures/goods-lift-qa-fixture'
import { createCarLiftQaFixture } from './fixtures/car-lift-qa-fixture'
import type { RegisteredLiftFamily } from '../elevator'

export interface DevelopmentMechanicalProjectActions {
  updateConfiguration: (configuration: unknown) => unknown
  createProject: () => void
  loadDevelopmentConfiguration?: (configuration: unknown) => unknown
}

/**
 * Loads deliberately isolated demo data for local visual inspection only.
 * This module is imported exclusively by DEV-only UI code and tests.
 */
export function loadDevelopmentMechanicalFixture(
  actions: DevelopmentMechanicalProjectActions,
) {
  const configuration = createPassengerMechanicalFixture()
  if (actions.loadDevelopmentConfiguration) {
    actions.loadDevelopmentConfiguration(configuration)
  } else {
    actions.updateConfiguration(configuration)
  }

  return configuration
}

export function resetDevelopmentMechanicalFixture(
  actions: DevelopmentMechanicalProjectActions,
) {
  actions.createProject()
}

/** Goods QA data use the same ephemeral persistence boundary as the passenger demo. */
export function loadDevelopmentGoodsFixture(
  actions: Required<Pick<DevelopmentMechanicalProjectActions, 'loadDevelopmentConfiguration'>>,
) {
  const configuration = createGoodsLiftQaFixture()
  actions.loadDevelopmentConfiguration(configuration)
  return configuration
}

const developmentFixtureFactories = {
  passenger: createPassengerMechanicalFixture,
  goods: createGoodsLiftQaFixture,
  car: createCarLiftQaFixture,
} as const

export function hasDevelopmentFixture(family: RegisteredLiftFamily): boolean {
  return Object.hasOwn(developmentFixtureFactories, family)
}

/** No passenger fallback. All family demos must use the ephemeral persistence boundary. */
export function loadDevelopmentFamilyFixture(
  family: RegisteredLiftFamily,
  actions: Required<Pick<DevelopmentMechanicalProjectActions, 'loadDevelopmentConfiguration'>>,
) {
  if (!hasDevelopmentFixture(family)) return { status: 'unavailable' } as const
  const configuration = developmentFixtureFactories[family as keyof typeof developmentFixtureFactories]()
  actions.loadDevelopmentConfiguration(configuration)
  return { status: 'loaded', configuration } as const
}
