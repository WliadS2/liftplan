import { z } from 'zod'
import {
  kilograms,
  metresPerSecond,
  millimetres,
  type Kilograms,
  type MetresPerSecond,
  type Millimetres,
} from '../../engineering'
import type { LiftConfiguration } from '../models/lift-configuration'
import { LIFT_FAMILIES } from '../types/lift-family'
import { passengerDoorSystemDataSchema, type PassengerDoorSystemData } from './passenger-door-data'
import {
  passengerMechanicalPlanningSchema,
  COUNTERWEIGHT_ARRANGEMENTS,
  type PassengerMechanicalPlanningInput,
} from './passenger-mechanical-planning'

export const PASSENGER_PLANNING_SCHEMA_VERSION = 'passenger-planning-v2' as const

export const COUNTERWEIGHT_POSITIONS = COUNTERWEIGHT_ARRANGEMENTS

export type CounterweightPosition = (typeof COUNTERWEIGHT_POSITIONS)[number]

export interface PassengerPlanningConfiguration
  extends LiftConfiguration<
    typeof LIFT_FAMILIES.passenger,
    typeof PASSENGER_PLANNING_SCHEMA_VERSION
  > {
  readonly projectName: string
  readonly capacityKg?: Kilograms
  readonly passengerCount?: number
  readonly stopCount?: number
  readonly ratedSpeedMetresPerSecond?: MetresPerSecond
  readonly cabinWidthMm?: Millimetres
  readonly cabinDepthMm?: Millimetres
  readonly cabinHeightMm?: Millimetres
  readonly doorWidthMm?: Millimetres
  readonly doorHeightMm?: Millimetres
  readonly shaftWidthMm?: Millimetres
  readonly shaftDepthMm?: Millimetres
  readonly floorHeightMm?: Millimetres
  readonly pitDepthMm?: Millimetres
  readonly headroomMm?: Millimetres
  readonly throughCar?: boolean
  readonly driveConcept?: string
  readonly counterweightWidthMm?: Millimetres
  readonly counterweightHeightMm?: Millimetres
  readonly counterweightDepthMm?: Millimetres
  readonly counterweightPosition?: CounterweightPosition
  readonly mechanical?: PassengerMechanicalPlanningInput
  readonly doors?: PassengerDoorSystemData
}

const optionalFiniteNumber = z.number().finite().optional()

const optionalKilograms = optionalFiniteNumber.transform((value) =>
  value === undefined ? undefined : kilograms(value),
)

const optionalMillimetres = optionalFiniteNumber.transform((value) =>
  value === undefined ? undefined : millimetres(value),
)

const optionalMetresPerSecond = optionalFiniteNumber.transform((value) =>
  value === undefined ? undefined : metresPerSecond(value),
)

export const passengerPlanningConfigurationSchema = z
  .object({
    family: z.literal(LIFT_FAMILIES.passenger),
    schemaVersion: z.literal(PASSENGER_PLANNING_SCHEMA_VERSION),
    projectName: z.string(),
    capacityKg: optionalKilograms,
    passengerCount: z.number().int().optional(),
    stopCount: z.number().int().optional(),
    ratedSpeedMetresPerSecond: optionalMetresPerSecond,
    cabinWidthMm: optionalMillimetres,
    cabinDepthMm: optionalMillimetres,
    cabinHeightMm: optionalMillimetres,
    doorWidthMm: optionalMillimetres,
    doorHeightMm: optionalMillimetres,
    shaftWidthMm: optionalMillimetres,
    shaftDepthMm: optionalMillimetres,
    floorHeightMm: optionalMillimetres,
    pitDepthMm: optionalMillimetres,
    headroomMm: optionalMillimetres,
    throughCar: z.boolean().optional(),
    driveConcept: z.string().optional(),
    counterweightWidthMm: optionalMillimetres,
    counterweightHeightMm: optionalMillimetres,
    counterweightDepthMm: optionalMillimetres,
    counterweightPosition: z.enum(COUNTERWEIGHT_POSITIONS).optional(),
    mechanical: passengerMechanicalPlanningSchema.optional(),
    doors: passengerDoorSystemDataSchema.optional(),
  })
  .strict()

export type PassengerPlanningConfigurationUpdate = Partial<
  Omit<PassengerPlanningConfiguration, 'family' | 'schemaVersion'>
>

export function createPassengerPlanningConfiguration(
  projectName: string,
): PassengerPlanningConfiguration {
  return {
    family: LIFT_FAMILIES.passenger,
    schemaVersion: PASSENGER_PLANNING_SCHEMA_VERSION,
    projectName,
  }
}

export function updatePassengerPlanningConfiguration(
  configuration: PassengerPlanningConfiguration,
  update: PassengerPlanningConfigurationUpdate,
): PassengerPlanningConfiguration {
  return { ...configuration, ...update }
}
