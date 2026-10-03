import type { CounterweightPosition } from '../../../elevator'
import {
  metres,
  millimetresToMetres,
  type Metres,
  type Millimetres,
} from '../../../engineering'
import type {
  LevelPlanningInput,
  PassengerGeometryPlanningInput,
} from '../lift-geometry-planning-input'

export type PassengerGeometryField =
  | 'cabin.widthMm'
  | 'cabin.depthMm'
  | 'cabin.heightMm'
  | 'cabin.doorWidthMm'
  | 'cabin.doorHeightMm'
  | 'cabin.throughCar'
  | 'shaft.widthMm'
  | 'shaft.depthMm'
  | 'shaft.pitDepthMm'
  | 'shaft.headroomMm'
  | 'levels.stopCount'
  | 'levels.floorHeightMm'
  | 'levels.elevationsMm'
  | 'counterweight.widthMm'
  | 'counterweight.heightMm'
  | 'counterweight.position'

export interface PassengerLandingLevelModel {
  readonly id: string
  readonly index: number
  readonly elevationY: Metres
}

export interface PassengerDoorModel {
  readonly width: Metres
  readonly height: Metres
}

export type PassengerEntranceSide = 'front' | 'rear'

export interface PassengerDoorLeafModel {
  readonly id: string
  readonly side: PassengerEntranceSide
  readonly position: 'left' | 'right'
  readonly width: Metres
  readonly height: Metres
}

export interface PassengerEntranceModel extends PassengerDoorModel {
  readonly side: PassengerEntranceSide
  readonly doorLeaves: readonly [
    PassengerDoorLeafModel,
    PassengerDoorLeafModel,
  ]
}

export interface PassengerCabinModel {
  readonly width: Metres
  readonly depth: Metres
  readonly height: Metres
  readonly bottomY: Metres
  readonly centerY: Metres
  readonly entrances: readonly PassengerEntranceModel[]
  readonly rearWall: 'closed' | 'opening' | 'unspecified'
  readonly throughCar?: boolean
}

export interface PassengerShaftVerticalExtent {
  readonly bottomY: Metres
  readonly topY: Metres
  readonly height: Metres
  readonly centerY: Metres
}

export interface PassengerShaftModel {
  readonly width: Metres
  readonly depth: Metres
  readonly verticalExtent?: PassengerShaftVerticalExtent
}

export interface PassengerLevelFootprintModel {
  readonly width: Metres
  readonly depth: Metres
}

export interface PassengerCounterweightModel {
  readonly width: Metres
  readonly height: Metres
  readonly center: readonly [Metres, Metres, Metres]
  readonly rotationY: number
  readonly position: CounterweightPosition
}

export interface PassengerPitModel {
  readonly width: Metres
  readonly depth: Metres
  readonly height: Metres
  readonly centerY: Metres
}

export interface PassengerInstallationBounds {
  readonly width: Metres
  readonly depth: Metres
  readonly height: Metres
  readonly centerY: Metres
}

export interface PassengerInstallationModel {
  readonly cabin?: PassengerCabinModel
  readonly shaft?: PassengerShaftModel
  readonly levels: readonly PassengerLandingLevelModel[]
  readonly levelFootprint?: PassengerLevelFootprintModel
  readonly counterweight?: PassengerCounterweightModel
  readonly pit?: PassengerPitModel
  readonly bounds: PassengerInstallationBounds
}

export type PassengerInstallationModelResult =
  | {
      readonly status: 'empty'
      readonly missingFields: readonly PassengerGeometryField[]
    }
  | {
      readonly status: 'partial'
      readonly model: PassengerInstallationModel
      readonly missingFields: readonly PassengerGeometryField[]
    }
  | {
      readonly status: 'complete'
      readonly model: PassengerInstallationModel
      readonly missingFields: readonly []
    }
  | {
      readonly status: 'invalid'
      readonly model?: PassengerInstallationModel
      readonly missingFields: readonly PassengerGeometryField[]
      readonly invalidFields: readonly PassengerGeometryField[]
    }

interface LevelElevationResult {
  readonly elevations: readonly Metres[]
  readonly missingFields: readonly PassengerGeometryField[]
  readonly invalidFields: readonly PassengerGeometryField[]
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function isNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

function uniqueFields(
  fields: readonly PassengerGeometryField[],
): readonly PassengerGeometryField[] {
  return [...new Set(fields)]
}

export function createUniformLevelElevations(
  stopCount: number,
  floorHeightMm: Millimetres,
): readonly Metres[] {
  const floorHeight = millimetresToMetres(floorHeightMm)

  return Array.from({ length: stopCount }, (_, index) =>
    metres(floorHeight * index),
  )
}

function createLevelElevations(levels: LevelPlanningInput): LevelElevationResult {
  if (levels.kind === 'explicit') {
    if (levels.elevationsMm.length === 0) {
      return {
        elevations: [],
        missingFields: ['levels.elevationsMm'],
        invalidFields: [],
      }
    }

    if (levels.elevationsMm.some((elevation) => !Number.isFinite(elevation))) {
      return {
        elevations: [],
        missingFields: [],
        invalidFields: ['levels.elevationsMm'],
      }
    }

    return {
      elevations: levels.elevationsMm.map(millimetresToMetres),
      missingFields: [],
      invalidFields: [],
    }
  }

  const { stopCount, floorHeightMm } = levels
  const missingFields: PassengerGeometryField[] = []
  const invalidFields: PassengerGeometryField[] = []

  if (stopCount === undefined) {
    missingFields.push('levels.stopCount')
  } else if (!Number.isInteger(stopCount) || !isPositive(stopCount)) {
    invalidFields.push('levels.stopCount')
  }

  if (floorHeightMm === undefined) {
    missingFields.push('levels.floorHeightMm')
  } else if (!isPositive(floorHeightMm)) {
    invalidFields.push('levels.floorHeightMm')
  }

  if (missingFields.length > 0 || invalidFields.length > 0) {
    return { elevations: [], missingFields, invalidFields }
  }

  return {
    elevations: createUniformLevelElevations(
      stopCount as number,
      floorHeightMm as Millimetres,
    ),
    missingFields: [],
    invalidFields: [],
  }
}

function createCounterweightModel(
  input: PassengerGeometryPlanningInput,
  shaft: PassengerShaftModel,
): PassengerCounterweightModel | undefined {
  const { widthMm, heightMm, position } = input.counterweight

  if (
    widthMm === undefined ||
    heightMm === undefined ||
    position === undefined ||
    !isPositive(widthMm) ||
    !isPositive(heightMm)
  ) {
    return undefined
  }

  const width = millimetresToMetres(widthMm)
  const height = millimetresToMetres(heightMm)
  const centerY = metres(height / 2)

  if (position === 'rear') {
    return {
      width,
      height,
      center: [metres(0), centerY, metres(-shaft.depth / 2)],
      rotationY: 0,
      position,
    }
  }

  return {
    width,
    height,
    center: [
      metres((position === 'left' ? -shaft.width : shaft.width) / 2),
      centerY,
      metres(0),
    ],
    rotationY: Math.PI / 2,
    position,
  }
}

function createEntranceModel(
  side: PassengerEntranceSide,
  door: PassengerDoorModel,
): PassengerEntranceModel {
  const leafWidth = metres(door.width / 2)

  return {
    side,
    width: door.width,
    height: door.height,
    doorLeaves: [
      {
        id: `${side}-door-left`,
        side,
        position: 'left',
        width: leafWidth,
        height: door.height,
      },
      {
        id: `${side}-door-right`,
        side,
        position: 'right',
        width: leafWidth,
        height: door.height,
      },
    ],
  }
}

function collectMissingFields(
  input: PassengerGeometryPlanningInput,
  levelMissingFields: readonly PassengerGeometryField[],
): readonly PassengerGeometryField[] {
  const fields: PassengerGeometryField[] = []
  const coreValues = [
    ['cabin.widthMm', input.cabin.widthMm],
    ['cabin.depthMm', input.cabin.depthMm],
    ['cabin.heightMm', input.cabin.heightMm],
    ['cabin.doorWidthMm', input.cabin.doorWidthMm],
    ['cabin.doorHeightMm', input.cabin.doorHeightMm],
    ['cabin.throughCar', input.cabin.throughCar],
    ['shaft.widthMm', input.shaft.widthMm],
    ['shaft.depthMm', input.shaft.depthMm],
    ['shaft.pitDepthMm', input.shaft.pitDepthMm],
    ['shaft.headroomMm', input.shaft.headroomMm],
  ] as const

  for (const [field, value] of coreValues) {
    if (value === undefined) {
      fields.push(field)
    }
  }

  fields.push(...levelMissingFields)

  const counterweightValues = [
    input.counterweight.widthMm,
    input.counterweight.heightMm,
    input.counterweight.position,
  ]
  const hasPartialCounterweight =
    counterweightValues.some((value) => value !== undefined) &&
    counterweightValues.some((value) => value === undefined)

  if (hasPartialCounterweight) {
    if (input.counterweight.widthMm === undefined) {
      fields.push('counterweight.widthMm')
    }
    if (input.counterweight.heightMm === undefined) {
      fields.push('counterweight.heightMm')
    }
    if (input.counterweight.position === undefined) {
      fields.push('counterweight.position')
    }
  }

  return uniqueFields(fields)
}

function collectInvalidFields(
  input: PassengerGeometryPlanningInput,
  levelInvalidFields: readonly PassengerGeometryField[],
): readonly PassengerGeometryField[] {
  const fields: PassengerGeometryField[] = [...levelInvalidFields]
  const positiveDimensions = [
    ['cabin.widthMm', input.cabin.widthMm],
    ['cabin.depthMm', input.cabin.depthMm],
    ['cabin.heightMm', input.cabin.heightMm],
    ['cabin.doorWidthMm', input.cabin.doorWidthMm],
    ['cabin.doorHeightMm', input.cabin.doorHeightMm],
    ['shaft.widthMm', input.shaft.widthMm],
    ['shaft.depthMm', input.shaft.depthMm],
    ['counterweight.widthMm', input.counterweight.widthMm],
    ['counterweight.heightMm', input.counterweight.heightMm],
  ] as const

  for (const [field, value] of positiveDimensions) {
    if (value !== undefined && !isPositive(value)) {
      fields.push(field)
    }
  }

  const nonNegativeDimensions = [
    ['shaft.pitDepthMm', input.shaft.pitDepthMm],
    ['shaft.headroomMm', input.shaft.headroomMm],
  ] as const

  for (const [field, value] of nonNegativeDimensions) {
    if (value !== undefined && !isNonNegative(value)) {
      fields.push(field)
    }
  }

  if (
    input.cabin.doorWidthMm !== undefined &&
    input.cabin.widthMm !== undefined &&
    input.cabin.doorWidthMm > input.cabin.widthMm
  ) {
    fields.push('cabin.doorWidthMm')
  }

  if (
    input.cabin.doorHeightMm !== undefined &&
    input.cabin.heightMm !== undefined &&
    input.cabin.doorHeightMm > input.cabin.heightMm
  ) {
    fields.push('cabin.doorHeightMm')
  }

  return uniqueFields(fields)
}

function createInstallationModel(
  input: PassengerGeometryPlanningInput,
  levelElevations: readonly Metres[],
): PassengerInstallationModel | undefined {
  const cabinHeight =
    input.cabin.heightMm === undefined
      ? undefined
      : millimetresToMetres(input.cabin.heightMm)
  const cabin =
    input.cabin.widthMm !== undefined &&
    input.cabin.depthMm !== undefined &&
    cabinHeight !== undefined &&
    isPositive(input.cabin.widthMm) &&
    isPositive(input.cabin.depthMm) &&
    isPositive(cabinHeight)
      ? {
          width: millimetresToMetres(input.cabin.widthMm),
          depth: millimetresToMetres(input.cabin.depthMm),
          height: cabinHeight,
          bottomY: metres(0),
          centerY: metres(cabinHeight / 2),
          throughCar: input.cabin.throughCar,
        }
      : undefined

  const door =
    cabin !== undefined &&
    input.cabin.doorWidthMm !== undefined &&
    input.cabin.doorHeightMm !== undefined &&
    isPositive(input.cabin.doorWidthMm) &&
    isPositive(input.cabin.doorHeightMm) &&
    millimetresToMetres(input.cabin.doorWidthMm) <= cabin.width &&
    millimetresToMetres(input.cabin.doorHeightMm) <= cabin.height
      ? {
          width: millimetresToMetres(input.cabin.doorWidthMm),
          height: millimetresToMetres(input.cabin.doorHeightMm),
        }
      : undefined

  const cabinAssembly =
    cabin === undefined
      ? undefined
      : {
          ...cabin,
          entrances:
            door === undefined
              ? []
              : [
                  createEntranceModel('front', door),
                  ...(cabin.throughCar === true
                    ? [createEntranceModel('rear', door)]
                    : []),
                ],
          rearWall:
            cabin.throughCar === true
              ? ('opening' as const)
              : cabin.throughCar === false
                ? ('closed' as const)
                : ('unspecified' as const),
        }

  const shaftBase =
    input.shaft.widthMm !== undefined &&
    input.shaft.depthMm !== undefined &&
    isPositive(input.shaft.widthMm) &&
    isPositive(input.shaft.depthMm)
      ? {
          width: millimetresToMetres(input.shaft.widthMm),
          depth: millimetresToMetres(input.shaft.depthMm),
        }
      : undefined

  const validPitDepth =
    input.shaft.pitDepthMm !== undefined &&
    isNonNegative(input.shaft.pitDepthMm)
      ? millimetresToMetres(input.shaft.pitDepthMm)
      : undefined
  const validHeadroom =
    input.shaft.headroomMm !== undefined &&
    isNonNegative(input.shaft.headroomMm)
      ? millimetresToMetres(input.shaft.headroomMm)
      : undefined

  const highestLevel =
    levelElevations.length > 0 ? Math.max(...levelElevations) : undefined
  const knownTopValues = [
    cabinAssembly?.height,
    highestLevel === undefined
      ? undefined
      : metres(highestLevel + (validHeadroom ?? 0)),
  ].filter((value): value is Metres => value !== undefined)
  const shaftBottomY = metres(-(validPitDepth ?? 0))
  const shaftTopY = metres(Math.max(0, ...knownTopValues))
  const shaftHeight = metres(shaftTopY - shaftBottomY)
  const shaftVerticalExtent =
    shaftBase !== undefined && shaftHeight > 0
      ? {
          bottomY: shaftBottomY,
          topY: shaftTopY,
          height: shaftHeight,
          centerY: metres(shaftBottomY + shaftHeight / 2),
        }
      : undefined
  const shaft =
    shaftBase === undefined
      ? undefined
      : { ...shaftBase, verticalExtent: shaftVerticalExtent }

  const levels = levelElevations.map((elevationY, index) => ({
    id: `level-${index + 1}`,
    index,
    elevationY,
  }))
  const levelFootprint = shaft
    ? { width: shaft.width, depth: shaft.depth }
    : cabinAssembly
      ? { width: cabinAssembly.width, depth: cabinAssembly.depth }
      : undefined
  const pit =
    shaft !== undefined && validPitDepth !== undefined && validPitDepth > 0
      ? {
          width: shaft.width,
          depth: shaft.depth,
          height: validPitDepth,
          centerY: metres(-validPitDepth / 2),
        }
      : undefined
  const counterweight =
    shaft === undefined ? undefined : createCounterweightModel(input, shaft)
  const hasGeometry =
    cabinAssembly !== undefined || shaft !== undefined || levels.length > 0

  if (!hasGeometry) {
    return undefined
  }

  const installationBottom = Math.min(
    0,
    shaft?.verticalExtent?.bottomY ?? 0,
  )
  const installationTop = Math.max(
    0,
    cabinAssembly?.height ?? 0,
    highestLevel ?? 0,
    shaft?.verticalExtent?.topY ?? 0,
    counterweight === undefined
      ? 0
      : counterweight.center[1] + counterweight.height / 2,
  )

  return {
    cabin: cabinAssembly,
    shaft,
    levels,
    levelFootprint,
    counterweight,
    pit,
    bounds: {
      width: metres(Math.max(cabinAssembly?.width ?? 0, shaft?.width ?? 0)),
      depth: metres(Math.max(cabinAssembly?.depth ?? 0, shaft?.depth ?? 0)),
      height: metres(installationTop - installationBottom),
      centerY: metres(
        installationBottom + (installationTop - installationBottom) / 2,
      ),
    },
  }
}

export function createPassengerInstallationModel(
  input: PassengerGeometryPlanningInput,
): PassengerInstallationModelResult {
  const levelResult = createLevelElevations(input.levels)
  const missingFields = collectMissingFields(
    input,
    levelResult.missingFields,
  )
  const invalidFields = collectInvalidFields(
    input,
    levelResult.invalidFields,
  )
  const model = createInstallationModel(input, levelResult.elevations)

  if (invalidFields.length > 0) {
    return {
      status: 'invalid',
      model,
      missingFields,
      invalidFields,
    }
  }

  if (model === undefined) {
    return { status: 'empty', missingFields }
  }

  if (missingFields.length > 0) {
    return { status: 'partial', model, missingFields }
  }

  return { status: 'complete', model, missingFields: [] }
}
