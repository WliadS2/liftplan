import {
  LIFT_FAMILIES,
  passengerPlanningConfigurationSchema,
  type CounterweightPosition,
  type RegisteredLiftConfiguration,
  type RegisteredLiftFamily,
} from '../../elevator'
import type { Millimetres, MetresPerSecond } from '../../engineering'
import type { PassengerMechanicalPlanningInput } from './passenger/mechanical/passenger-mechanical-planning-input'
import type { PassengerDoorSystemData } from '../../elevator/configuration/passenger-door-data'
import type { LandingSettings } from '../../elevator/configuration/landing-planning'

export interface UniformLevelPlanningInput {
  readonly kind: 'uniform'
  readonly stopCount?: number
  readonly floorHeightMm?: Millimetres
  readonly landingSettings?: readonly LandingSettings[]
  readonly rearAccess?: boolean
}

export interface ExplicitLevelPlanningInput {
  readonly kind: 'explicit'
  readonly elevationsMm: readonly (Millimetres | null)[]
  readonly stopCount?: number
  readonly landingSettings?: readonly LandingSettings[]
  readonly rearAccess?: boolean
}

export type LevelPlanningInput =
  | UniformLevelPlanningInput
  | ExplicitLevelPlanningInput

export interface PassengerGeometryPlanningInput {
  readonly nominalSpeedMetresPerSecond?: MetresPerSecond
  readonly liftFamily: typeof LIFT_FAMILIES.passenger
  readonly sourceSchemaVersion: string
  readonly cabin: {
    readonly widthMm?: Millimetres
    readonly depthMm?: Millimetres
    readonly heightMm?: Millimetres
    readonly doorWidthMm?: Millimetres
    readonly doorHeightMm?: Millimetres
    readonly throughCar?: boolean
  }
  readonly shaft: {
    readonly widthMm?: Millimetres
    readonly depthMm?: Millimetres
    readonly pitDepthMm?: Millimetres
    readonly headroomMm?: Millimetres
  }
  readonly levels: LevelPlanningInput
  readonly cabinLevelIndex?: number
  readonly counterweight: {
    readonly widthMm?: Millimetres
    readonly heightMm?: Millimetres
    readonly depthMm?: Millimetres
    readonly position?: CounterweightPosition
  }
  readonly mechanical: PassengerMechanicalPlanningInput
  readonly doors?: PassengerDoorSystemData
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
    nominalSpeedMetresPerSecond: planning.ratedSpeedMetresPerSecond,
    liftFamily: planning.family,
    sourceSchemaVersion: planning.schemaVersion,
    doors: planning.doors,
    cabin: {
      widthMm: planning.cabinWidthMm,
      depthMm: planning.cabinDepthMm,
      heightMm: planning.cabinHeightMm,
      doorWidthMm: planning.doorWidthMm,
      doorHeightMm: planning.doorHeightMm,
      throughCar: planning.throughCar,
    },
    shaft: {
      widthMm: planning.shaftWidthMm,
      depthMm: planning.shaftDepthMm,
      pitDepthMm: planning.pitDepthMm,
      headroomMm: planning.headroomMm,
    },
    cabinLevelIndex: planning.cabinLevelIndex,
    levels: planning.levelElevationsMm ? { kind: 'explicit', elevationsMm: planning.levelElevationsMm,
      stopCount: planning.stopCount, landingSettings: planning.landingSettings, rearAccess: planning.throughCar } : {
      kind: 'uniform',
      stopCount: planning.stopCount,
      floorHeightMm: planning.floorHeightMm,
      landingSettings: planning.landingSettings,
      rearAccess: planning.throughCar,
    },
    counterweight: {
      widthMm: planning.counterweightWidthMm,
      heightMm: planning.counterweightHeightMm,
      depthMm: planning.counterweightDepthMm,
      position: planning.mechanical?.counterweightArrangement ?? planning.counterweightPosition,
    },
    mechanical: {
      ...planning.mechanical,
      counterweightArrangement: planning.mechanical?.counterweightArrangement ?? planning.counterweightPosition,
      driveConcept: planning.mechanical?.driveConcept ?? planning.driveConcept,
    },
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
