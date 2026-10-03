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

export const PASSENGER_PLANNING_SCHEMA_VERSION = 'passenger-planning-v1' as const

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
  readonly throughCar?: boolean
  readonly driveConcept?: string
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
    throughCar: z.boolean().optional(),
    driveConcept: z.string().optional(),
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
