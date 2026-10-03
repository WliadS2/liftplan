import {
  LIFT_FAMILIES,
  passengerPlanningConfigurationSchema,
  type RegisteredLiftConfiguration,
  type RegisteredLiftFamily,
} from '../../elevator'
import type {
  MetresPerSecond,
  Millimetres,
} from '../../engineering'

export interface PassengerGeometryPlanningInput {
  readonly liftFamily: typeof LIFT_FAMILIES.passenger
  readonly sourceSchemaVersion: string
  readonly cabinWidthMm?: Millimetres
  readonly cabinDepthMm?: Millimetres
  readonly cabinHeightMm?: Millimetres
  readonly doorWidthMm?: Millimetres
  readonly doorHeightMm?: Millimetres
  readonly ratedSpeedMetresPerSecond?: MetresPerSecond
  readonly throughCar?: boolean
}

export type LiftGeometryPlanningInput = PassengerGeometryPlanningInput

interface GeometryPlanningAdapter {
  readonly moduleId: string
  readonly toPlanningInput: (
    configuration: RegisteredLiftConfiguration,
  ) => LiftGeometryPlanningInput | undefined
}

function createPassengerGeometryPlanningInput(
  configuration: RegisteredLiftConfiguration,
): PassengerGeometryPlanningInput | undefined {
  const result = passengerPlanningConfigurationSchema.safeParse(configuration)

  if (!result.success) {
    return undefined
  }

  const planning = result.data

  return {
    liftFamily: planning.family,
    sourceSchemaVersion: planning.schemaVersion,
    cabinWidthMm: planning.cabinWidthMm,
    cabinDepthMm: planning.cabinDepthMm,
    cabinHeightMm: planning.cabinHeightMm,
    doorWidthMm: planning.doorWidthMm,
    doorHeightMm: planning.doorHeightMm,
    ratedSpeedMetresPerSecond: planning.ratedSpeedMetresPerSecond,
    throughCar: planning.throughCar,
  }
}

const geometryPlanningAdapters: Partial<
  Record<RegisteredLiftFamily, GeometryPlanningAdapter>
> = {
  passenger: {
    moduleId: 'passenger-planning-geometry',
    toPlanningInput: createPassengerGeometryPlanningInput,
  },
}

export function createLiftGeometryPlanningInput(
  configuration: RegisteredLiftConfiguration,
): LiftGeometryPlanningInput | undefined {
  return geometryPlanningAdapters[configuration.family]?.toPlanningInput(
    configuration,
  )
}
