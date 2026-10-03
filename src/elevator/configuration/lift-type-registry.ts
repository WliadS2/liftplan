import { z } from 'zod'
import { LIFT_FAMILIES } from '../types/lift-family'
import type { LiftTypeDefinition } from './lift-type-definition'
import {
  createPassengerPlanningConfiguration,
  passengerPlanningConfigurationSchema,
  type PassengerPlanningConfiguration,
} from './passenger-planning-configuration'
import {
  createUnavailableLiftConfiguration,
  createUnavailableLiftConfigurationSchema,
  type UnavailableLiftConfiguration,
} from './unavailable-lift-configuration'

export const REGISTERED_LIFT_FAMILIES = [
  LIFT_FAMILIES.passenger,
  LIFT_FAMILIES.goods,
  LIFT_FAMILIES.car,
  LIFT_FAMILIES.smallGoods,
  LIFT_FAMILIES.hospitalBed,
  LIFT_FAMILIES.home,
  LIFT_FAMILIES.platform,
] as const

export type RegisteredLiftFamily = (typeof REGISTERED_LIFT_FAMILIES)[number]

type UnavailableRegisteredLiftFamily = Exclude<
  RegisteredLiftFamily,
  typeof LIFT_FAMILIES.passenger
>

const passengerLiftType: LiftTypeDefinition<PassengerPlanningConfiguration> = {
  id: LIFT_FAMILIES.passenger,
  displayName: 'Personenaufzug',
  description: 'Planungskonfiguration für Personenaufzüge.',
  implementationStatus: 'available',
  configurationSchema: passengerPlanningConfigurationSchema,
  createDefaultConfiguration: (projectName) =>
    createPassengerPlanningConfiguration(projectName),
  engineeringModule: {
    id: 'passenger-engineering',
    status: 'planned',
  },
  geometryModule: {
    id: 'passenger-planning-geometry',
    status: 'available',
  },
  uiSections: [
    { id: 'project', order: 10, titleKey: 'configuration.project' },
    { id: 'planning', order: 20, titleKey: 'configuration.planning' },
  ],
}

function createComingSoonLiftType<Family extends UnavailableRegisteredLiftFamily>(
  id: Family,
  displayName: string,
  description: string,
): LiftTypeDefinition<UnavailableLiftConfiguration<Family>> {
  return {
    id,
    displayName,
    description,
    implementationStatus: 'coming-soon',
    configurationSchema: createUnavailableLiftConfigurationSchema(id),
    createDefaultConfiguration: () => createUnavailableLiftConfiguration(id),
    engineeringModule: {
      id: `${id}-engineering`,
      status: 'planned',
    },
    geometryModule: {
      id: `${id}-geometry`,
      status: 'planned',
    },
    uiSections: [],
  }
}

export const liftTypeRegistry = {
  passenger: passengerLiftType,
  goods: createComingSoonLiftType(
    LIFT_FAMILIES.goods,
    'Warenaufzug / Lastenaufzug',
    'Planungskonfiguration wird vorbereitet.',
  ),
  car: createComingSoonLiftType(
    LIFT_FAMILIES.car,
    'Autoaufzug',
    'Planungskonfiguration wird vorbereitet.',
  ),
  'small-goods': createComingSoonLiftType(
    LIFT_FAMILIES.smallGoods,
    'Kleingüteraufzug',
    'Planungskonfiguration wird vorbereitet.',
  ),
  'hospital-bed': createComingSoonLiftType(
    LIFT_FAMILIES.hospitalBed,
    'Bettenaufzug',
    'Planungskonfiguration wird vorbereitet.',
  ),
  home: createComingSoonLiftType(
    LIFT_FAMILIES.home,
    'Homelift',
    'Planungskonfiguration wird vorbereitet.',
  ),
  platform: createComingSoonLiftType(
    LIFT_FAMILIES.platform,
    'Plattformlift',
    'Planungskonfiguration wird vorbereitet.',
  ),
} as const

export type RegisteredLiftConfiguration = ReturnType<
  (typeof liftTypeRegistry)[RegisteredLiftFamily]['createDefaultConfiguration']
>

export const registeredLiftFamilySchema = z.enum(REGISTERED_LIFT_FAMILIES)

export function isRegisteredLiftFamily(
  family: string,
): family is RegisteredLiftFamily {
  return registeredLiftFamilySchema.safeParse(family).success
}

export function getLiftTypeDefinition(family: RegisteredLiftFamily) {
  return liftTypeRegistry[family]
}

export function getLiftTypeDefinitions() {
  return Object.values(liftTypeRegistry)
}

export function createDefaultLiftConfiguration(
  family: RegisteredLiftFamily,
  projectName: string,
) {
  return getLiftTypeDefinition(family).createDefaultConfiguration(projectName)
}
