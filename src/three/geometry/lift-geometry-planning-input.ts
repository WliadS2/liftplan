import {
  LIFT_FAMILIES,
  passengerPlanningConfigurationSchema,
  type CounterweightPosition,
  type RegisteredLiftConfiguration,
  type RegisteredLiftFamily,
} from '../../elevator'
import type { Millimetres } from '../../engineering'

export interface UniformLevelPlanningInput {
  readonly kind: 'uniform'
  readonly stopCount?: number
  readonly floorHeightMm?: Millimetres
}

export interface ExplicitLevelPlanningInput {
  readonly kind: 'explicit'
  readonly elevationsMm: readonly Millimetres[]
}

export type LevelPlanningInput =
  | UniformLevelPlanningInput
  | ExplicitLevelPlanningInput

export interface PassengerGeometryPlanningInput {
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
  readonly counterweight: {
    readonly widthMm?: Millimetres
    readonly heightMm?: Millimetres
    readonly position?: CounterweightPosition
  }
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
    levels: {
      kind: 'uniform',
      stopCount: planning.stopCount,
      floorHeightMm: planning.floorHeightMm,
    },
    counterweight: {
      widthMm: planning.counterweightWidthMm,
      heightMm: planning.counterweightHeightMm,
      position: planning.counterweightPosition,
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
