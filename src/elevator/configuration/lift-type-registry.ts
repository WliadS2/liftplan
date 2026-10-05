import { z } from 'zod'
import { LIFT_FAMILIES } from '../types/lift-family'
import type { LiftCapabilityName, LiftTypeDefinition } from './lift-type-definition'
import {
  createCarLiftPlanningConfiguration,
  carLiftPlanningConfigurationSchema,
  type CarLiftPlanningConfiguration,
} from './car-lift-configuration'
import {
  createGoodsLiftPlanningConfiguration,
  goodsLiftPlanningConfigurationSchema,
  type GoodsLiftPlanningConfiguration,
} from './goods-lift-configuration'
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
  LIFT_FAMILIES.heavyDuty,
] as const

export type RegisteredLiftFamily = (typeof REGISTERED_LIFT_FAMILIES)[number]

type UnavailableRegisteredLiftFamily = Exclude<
  RegisteredLiftFamily,
  typeof LIFT_FAMILIES.passenger
  | typeof LIFT_FAMILIES.goods
  | typeof LIFT_FAMILIES.car
>

const available = (moduleId: string) => ({ status: 'available', moduleId } as const)
const unavailable = (moduleId?: string) => ({ status: 'unavailable', moduleId } as const)

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
  capabilities: {
    configuration: available('passenger-configuration'),
    normalization: available('passenger-installation-model'),
    validation: available('passenger-spatial-validation'),
    geometry: available('passenger-planning-geometry'),
    three: available('passenger-three'),
    simulation: available('passenger-simulation'),
    drawings: available('passenger-technical-drawings'),
    pdf: available('technical-plan-pdf'),
    dxf: available('technical-plan-dxf'),
    persistence: available('liftplan-indexeddb'),
    migration: available('liftplan-project-migrations'),
  },
  uiSections: [
    { id: 'project', order: 10, titleKey: 'configuration.project' },
    { id: 'planning', order: 20, titleKey: 'configuration.planning' },
  ],
}

const goodsLiftType: LiftTypeDefinition<GoodsLiftPlanningConfiguration> = {
  id: LIFT_FAMILIES.goods,
  displayName: 'Waren-/Lastenaufzug',
  description: 'Geometrische Planungskonfiguration für Waren- und Lastenaufzüge.',
  implementationStatus: 'available',
  configurationSchema: goodsLiftPlanningConfigurationSchema,
  createDefaultConfiguration: createGoodsLiftPlanningConfiguration,
  engineeringModule: { id: 'goods-lift-engineering', status: 'available' },
  geometryModule: { id: 'goods-lift-geometry', status: 'available' },
  capabilities: {
    configuration: available('goods-lift-configuration'),
    normalization: available('goods-lift-model'),
    validation: available('goods-lift-spatial-validation'),
    geometry: available('goods-lift-model'),
    three: available('goods-lift-scene-model'),
    simulation: unavailable('goods-lift-simulation'),
    drawings: available('goods-lift-technical-drawings'),
    pdf: available('technical-plan-pdf'),
    dxf: available('technical-plan-dxf'),
    persistence: available('liftplan-indexeddb'),
    migration: available('goods-lift-configuration-migration'),
  },
  uiSections: [
    { id: 'project', order: 10, titleKey: 'configuration.project' },
    { id: 'goods-planning', order: 20, titleKey: 'configuration.goodsPlanning' },
  ],
}

const carLiftType: LiftTypeDefinition<CarLiftPlanningConfiguration> = {
  id: LIFT_FAMILIES.car,
  displayName: 'Autoaufzug',
  description: 'Geometrische Planungskonfiguration für Autoaufzüge.',
  implementationStatus: 'available',
  configurationSchema: carLiftPlanningConfigurationSchema,
  createDefaultConfiguration: createCarLiftPlanningConfiguration,
  engineeringModule: { id: 'car-lift-engineering', status: 'available' },
  geometryModule: { id: 'car-lift-geometry', status: 'available' },
  capabilities: {
    configuration: available('car-lift-configuration'),
    normalization: available('car-lift-model'),
    validation: available('car-lift-spatial-validation'),
    geometry: available('car-lift-model'),
    three: available('car-lift-scene-model'),
    simulation: unavailable('car-lift-simulation'),
    drawings: available('car-lift-technical-drawings'),
    pdf: available('technical-plan-pdf'),
    dxf: available('technical-plan-dxf'),
    persistence: available('liftplan-indexeddb'),
    migration: available('car-lift-configuration-migration'),
  },
  uiSections: [
    { id: 'project', order: 10, titleKey: 'configuration.project' },
    { id: 'car-planning', order: 20, titleKey: 'configuration.carPlanning' },
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
    capabilities: {
      configuration: unavailable(`${id}-configuration`),
      normalization: unavailable(`${id}-normalization`),
      validation: unavailable(`${id}-validation`),
      geometry: unavailable(`${id}-geometry`),
      three: unavailable(`${id}-three`),
      simulation: unavailable(`${id}-simulation`),
      drawings: unavailable(`${id}-drawings`),
      pdf: unavailable(`${id}-pdf`),
      dxf: unavailable(`${id}-dxf`),
      persistence: available('liftplan-indexeddb'),
      migration: available('liftplan-project-migrations'),
    },
    uiSections: [],
  }
}

export const liftTypeRegistry = {
  passenger: passengerLiftType,
  goods: goodsLiftType,
  car: carLiftType,
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
  'heavy-duty': createComingSoonLiftType(
    LIFT_FAMILIES.heavyDuty,
    'Schwerlast-/Spezialaufzug',
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

export function getLiftFamilyCapability(family: RegisteredLiftFamily, capability: LiftCapabilityName) {
  return getLiftTypeDefinition(family).capabilities[capability]
}

export function createDefaultLiftConfiguration(
  family: RegisteredLiftFamily,
  projectName: string,
) {
  return getLiftTypeDefinition(family).createDefaultConfiguration(projectName)
}
