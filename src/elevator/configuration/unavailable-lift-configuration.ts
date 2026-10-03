import { z } from 'zod'
import type { LiftConfiguration } from '../models/lift-configuration'
import type { LiftFamily } from '../types/lift-family'

export const UNAVAILABLE_LIFT_CONFIGURATION_SCHEMA_VERSION =
  'lift-planning-placeholder-v1' as const

export type UnavailableLiftConfiguration<Family extends LiftFamily> =
  LiftConfiguration<Family, typeof UNAVAILABLE_LIFT_CONFIGURATION_SCHEMA_VERSION>

export function createUnavailableLiftConfiguration<Family extends LiftFamily>(
  family: Family,
): UnavailableLiftConfiguration<Family> {
  return {
    family,
    schemaVersion: UNAVAILABLE_LIFT_CONFIGURATION_SCHEMA_VERSION,
  }
}

export function createUnavailableLiftConfigurationSchema<
  Family extends LiftFamily,
>(family: Family) {
  return z
    .object({
      family: z.literal(family),
      schemaVersion: z.literal(UNAVAILABLE_LIFT_CONFIGURATION_SCHEMA_VERSION),
    })
    .strict()
}
