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

export interface PassengerCabinModel {
  readonly width: Metres
  readonly depth: Metres
  readonly height: Metres
  readonly bottomY: Metres
  readonly centerY: Metres
  readonly doorWidth: Metres
  readonly doorHeight: Metres
  readonly throughCar: boolean
}

export interface PassengerShaftModel {
  readonly width: Metres
  readonly depth: Metres
  readonly bottomY: Metres
  readonly topY: Metres
  readonly height: Metres
  readonly centerY: Metres
}

export interface PassengerGuideRailModel {
  readonly xPositions: readonly [Metres, Metres]
  readonly z: Metres
  readonly bottomY: Metres
  readonly topY: Metres
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
  readonly cabin: PassengerCabinModel
  readonly shaft: PassengerShaftModel
  readonly levels: readonly PassengerLandingLevelModel[]
  readonly guideRails: PassengerGuideRailModel
  readonly counterweight?: PassengerCounterweightModel
  readonly pit?: PassengerPitModel
  readonly bounds: PassengerInstallationBounds
}

export type PassengerInstallationModelResult =
  | {
      readonly status: 'ready'
      readonly model: PassengerInstallationModel
    }
  | {
      readonly status: 'incomplete'
      readonly missingFields: readonly PassengerGeometryField[]
    }
  | {
      readonly status: 'invalid'
      readonly invalidFields: readonly PassengerGeometryField[]
    }

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function isNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
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

function createLevelElevations(
  levels: LevelPlanningInput,
):
  | { readonly status: 'ready'; readonly elevations: readonly Metres[] }
  | {
      readonly status: 'incomplete'
      readonly missingFields: readonly PassengerGeometryField[]
    }
  | {
      readonly status: 'invalid'
      readonly invalidFields: readonly PassengerGeometryField[]
    } {
  if (levels.kind === 'explicit') {
    if (levels.elevationsMm.length === 0) {
      return { status: 'incomplete', missingFields: ['levels.elevationsMm'] }
    }

    if (levels.elevationsMm.some((elevation) => !Number.isFinite(elevation))) {
      return { status: 'invalid', invalidFields: ['levels.elevationsMm'] }
    }

    return {
      status: 'ready',
      elevations: levels.elevationsMm.map(millimetresToMetres),
    }
  }

  const { stopCount, floorHeightMm } = levels
  const missingFields: PassengerGeometryField[] = []

  if (stopCount === undefined) {
    missingFields.push('levels.stopCount')
  }

  if (floorHeightMm === undefined) {
    missingFields.push('levels.floorHeightMm')
  }

  if (missingFields.length > 0) {
    return { status: 'incomplete', missingFields }
  }

  if (
    stopCount === undefined ||
    floorHeightMm === undefined ||
    !Number.isInteger(stopCount) ||
    !isPositive(stopCount) ||
    !isPositive(floorHeightMm)
  ) {
    return {
      status: 'invalid',
      invalidFields: [
        stopCount === undefined ||
        !Number.isInteger(stopCount) ||
        !isPositive(stopCount)
          ? 'levels.stopCount'
          : 'levels.floorHeightMm',
      ],
    }
  }

  return {
    status: 'ready',
    elevations: createUniformLevelElevations(
      stopCount,
      floorHeightMm,
    ),
  }
}

function createCounterweightModel(
  input: PassengerGeometryPlanningInput,
  shaftWidth: Metres,
  shaftDepth: Metres,
): PassengerCounterweightModel | undefined {
  const { widthMm, heightMm, position } = input.counterweight

  if (widthMm === undefined || heightMm === undefined || position === undefined) {
    return undefined
  }

  const width = millimetresToMetres(widthMm)
  const height = millimetresToMetres(heightMm)
  const centerY = metres(height / 2)

  if (position === 'rear') {
    return {
      width,
      height,
      center: [metres(0), centerY, metres(-shaftDepth / 2)],
      rotationY: 0,
      position,
    }
  }

  return {
    width,
    height,
    center: [
      metres((position === 'left' ? -shaftWidth : shaftWidth) / 2),
      centerY,
      metres(0),
    ],
    rotationY: Math.PI / 2,
    position,
  }
}

export function createPassengerInstallationModel(
  input: PassengerGeometryPlanningInput,
): PassengerInstallationModelResult {
  const requiredDimensions = [
    ['cabin.widthMm', input.cabin.widthMm],
    ['cabin.depthMm', input.cabin.depthMm],
    ['cabin.heightMm', input.cabin.heightMm],
    ['cabin.doorWidthMm', input.cabin.doorWidthMm],
    ['cabin.doorHeightMm', input.cabin.doorHeightMm],
    ['shaft.widthMm', input.shaft.widthMm],
    ['shaft.depthMm', input.shaft.depthMm],
    ['shaft.pitDepthMm', input.shaft.pitDepthMm],
    ['shaft.headroomMm', input.shaft.headroomMm],
  ] as const

  const missingFields: PassengerGeometryField[] = requiredDimensions
    .filter(([, value]) => value === undefined)
    .map(([field]) => field)

  if (input.cabin.throughCar === undefined) {
    missingFields.push('cabin.throughCar')
  }

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
      missingFields.push('counterweight.widthMm')
    }
    if (input.counterweight.heightMm === undefined) {
      missingFields.push('counterweight.heightMm')
    }
    if (input.counterweight.position === undefined) {
      missingFields.push('counterweight.position')
    }
  }

  const levelResult = createLevelElevations(input.levels)

  if (levelResult.status === 'incomplete') {
    return {
      status: 'incomplete',
      missingFields: [...missingFields, ...levelResult.missingFields],
    }
  }

  if (missingFields.length > 0) {
    return { status: 'incomplete', missingFields }
  }

  if (levelResult.status === 'invalid') {
    return levelResult
  }

  const {
    widthMm: cabinWidthMm,
    depthMm: cabinDepthMm,
    heightMm: cabinHeightMm,
    doorWidthMm,
    doorHeightMm,
  } = input.cabin
  const {
    widthMm: shaftWidthMm,
    depthMm: shaftDepthMm,
    pitDepthMm,
    headroomMm,
  } = input.shaft

  if (
    cabinWidthMm === undefined ||
    cabinDepthMm === undefined ||
    cabinHeightMm === undefined ||
    doorWidthMm === undefined ||
    doorHeightMm === undefined ||
    shaftWidthMm === undefined ||
    shaftDepthMm === undefined ||
    pitDepthMm === undefined ||
    headroomMm === undefined ||
    input.cabin.throughCar === undefined
  ) {
    return { status: 'incomplete', missingFields }
  }

  const invalidFields: PassengerGeometryField[] = []

  for (const [field, value] of requiredDimensions) {
    const acceptsZero =
      field === 'shaft.pitDepthMm' || field === 'shaft.headroomMm'
    if (value !== undefined && !(acceptsZero ? isNonNegative(value) : isPositive(value))) {
      invalidFields.push(field)
    }
  }

  if (doorWidthMm > cabinWidthMm) {
    invalidFields.push('cabin.doorWidthMm')
  }

  if (doorHeightMm > cabinHeightMm) {
    invalidFields.push('cabin.doorHeightMm')
  }

  if (
    input.counterweight.widthMm !== undefined &&
    !isPositive(input.counterweight.widthMm)
  ) {
    invalidFields.push('counterweight.widthMm')
  }

  if (
    input.counterweight.heightMm !== undefined &&
    !isPositive(input.counterweight.heightMm)
  ) {
    invalidFields.push('counterweight.heightMm')
  }

  if (invalidFields.length > 0) {
    return { status: 'invalid', invalidFields }
  }

  const cabinWidth = millimetresToMetres(cabinWidthMm)
  const cabinDepth = millimetresToMetres(cabinDepthMm)
  const cabinHeight = millimetresToMetres(cabinHeightMm)
  const shaftWidth = millimetresToMetres(shaftWidthMm)
  const shaftDepth = millimetresToMetres(shaftDepthMm)
  const pitDepth = millimetresToMetres(pitDepthMm)
  const headroom = millimetresToMetres(headroomMm)
  const bottomY = metres(-pitDepth)
  const highestLevel = Math.max(...levelResult.elevations)
  const topY = metres(highestLevel + headroom)
  const shaftHeight = metres(topY - bottomY)
  const shaftCenterY = metres(bottomY + shaftHeight / 2)
  const cabinCenterY = metres(cabinHeight / 2)
  const counterweight = createCounterweightModel(
    input,
    shaftWidth,
    shaftDepth,
  )
  const installationBottom = Math.min(bottomY, 0)
  const installationTop = Math.max(
    topY,
    cabinHeight,
    counterweight === undefined
      ? Number.NEGATIVE_INFINITY
      : counterweight.center[1] + counterweight.height / 2,
  )

  return {
    status: 'ready',
    model: {
      cabin: {
        width: cabinWidth,
        depth: cabinDepth,
        height: cabinHeight,
        bottomY: metres(0),
        centerY: cabinCenterY,
        doorWidth: millimetresToMetres(doorWidthMm),
        doorHeight: millimetresToMetres(doorHeightMm),
        throughCar: input.cabin.throughCar,
      },
      shaft: {
        width: shaftWidth,
        depth: shaftDepth,
        bottomY,
        topY,
        height: shaftHeight,
        centerY: shaftCenterY,
      },
      levels: levelResult.elevations.map((elevationY, index) => ({
        id: `level-${index + 1}`,
        index,
        elevationY,
      })),
      guideRails: {
        xPositions: [metres(-cabinWidth / 2), metres(cabinWidth / 2)],
        z: metres(0),
        bottomY,
        topY,
      },
      counterweight,
      pit:
        pitDepth > 0
          ? {
              width: shaftWidth,
              depth: shaftDepth,
              height: pitDepth,
              centerY: metres(-pitDepth / 2),
            }
          : undefined,
      bounds: {
        width: metres(Math.max(shaftWidth, cabinWidth)),
        depth: metres(Math.max(shaftDepth, cabinDepth)),
        height: metres(installationTop - installationBottom),
        centerY: metres(
          installationBottom + (installationTop - installationBottom) / 2,
        ),
      },
    },
  }
}
