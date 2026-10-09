import { millimetres, type Millimetres, type MetresPerSecond } from '../../engineering'
import { normalizeCarrierMechanics, type CarrierMechanicalModel } from '../models/carrier-mechanical-model'
import { normalizeCarrierDrive, type CarrierDriveModel } from '../models/carrier-drive-model'
import { normalizeLandings, type NormalizedLanding, type LandingIssue } from '../configuration/landing-planning'
import type {
  CarLiftApproachEnvelope,
  CarLiftPlanningConfiguration,
} from '../configuration/car-lift-configuration'

export type CarLiftModelField =
  | 'platformWidthMm' | 'platformDepthMm' | 'usableHeightMm'
  | 'doorClearWidthMm' | 'doorClearHeightMm'
  | 'shaftWidthMm' | 'shaftDepthMm' | 'pitDepthMm' | 'headroomMm'
  | 'stopCount' | 'storeyHeightsMm' | 'levelElevationsMm'
  | 'frontAccess' | 'rearAccess' | 'throughCar' | 'vehicleLoadingDirection'
  | 'vehicle' | 'vehiclePosition' | 'entryApproachEnvelope'
  | 'exitApproachEnvelope' | 'vehicleSweptEnvelope' | 'doorPassageEnvelope'

export interface CarPlanPointMm {
  readonly x: Millimetres
  readonly z: Millimetres
}

export interface CarPlanRectangleMm {
  readonly minX: Millimetres
  readonly maxX: Millimetres
  readonly minZ: Millimetres
  readonly maxZ: Millimetres
}

export interface CarBoxMm extends CarPlanRectangleMm {
  readonly minY: Millimetres
  readonly maxY: Millimetres
}

export type CarLevelModel = NormalizedLanding

export interface CarEntranceModel {
  readonly id: 'car-front' | 'car-rear'
  readonly side: 'front' | 'rear'
  readonly clearWidthMm: Millimetres
  readonly clearHeightMm: Millimetres
}

export interface NormalizedVehicleModel {
  readonly widthMm: Millimetres
  readonly lengthMm: Millimetres
  readonly heightMm?: Millimetres
  readonly massKg?: number
  readonly frontOverhangMm?: Millimetres
  readonly rearOverhangMm?: Millimetres
  readonly wheelbaseMm?: Millimetres
  readonly trackWidthMm?: Millimetres
  readonly headingDegrees?: number
  readonly center?: CarPlanPointMm
  readonly footprint?: readonly CarPlanPointMm[]
  readonly bounds?: CarBoxMm
  readonly wheelContactPoints?: readonly CarPlanPointMm[]
  readonly centerline?: readonly [CarPlanPointMm, CarPlanPointMm]
}

export interface NormalizedCarApproachEnvelope {
  readonly id: 'car-entry-approach' | 'car-exit-approach' | 'car-vehicle-sweep'
  readonly bounds: CarBoxMm
  readonly center: CarPlanPointMm
  readonly widthMm: Millimetres
  readonly lengthMm: Millimetres
  readonly heightMm?: Millimetres
  readonly headingDegrees: number
}

export interface CarLiftNormalizedModel {
  readonly nominalSpeedMetresPerSecond?: MetresPerSecond
  readonly family: 'car'
  readonly mechanical?: CarrierMechanicalModel
  readonly drive: CarrierDriveModel
  readonly sourceSchemaVersion: string
  readonly projectName: string
  readonly platform?: CarBoxMm
  readonly shaft?: CarBoxMm
  readonly movingEnvelope?: CarBoxMm
  readonly entrances: readonly CarEntranceModel[]
  readonly levels: readonly CarLevelModel[]
  readonly landingIssues?: readonly LandingIssue[]
  readonly vehicle?: NormalizedVehicleModel
  readonly entryApproachEnvelope?: NormalizedCarApproachEnvelope
  readonly exitApproachEnvelope?: NormalizedCarApproachEnvelope
  readonly vehicleSweptEnvelope?: NormalizedCarApproachEnvelope
  readonly doorPassageEnvelope?: {
    readonly clearWidthMm?: Millimetres
    readonly clearHeightMm?: Millimetres
    readonly depthMm?: Millimetres
  }
  readonly guideSystem?: {
    readonly orientation: 'x' | 'z'
    readonly spacingMm: Millimetres
  }
  readonly vehicleLoadingDirection?: 'shaft-x' | 'shaft-z'
  readonly throughCar?: boolean
  readonly frontAccess?: boolean
  readonly rearAccess?: boolean
}

export type CarLiftNormalizationResult =
  | { readonly status: 'empty'; readonly missingFields: readonly CarLiftModelField[] }
  | { readonly status: 'partial'; readonly model: CarLiftNormalizedModel; readonly missingFields: readonly CarLiftModelField[] }
  | { readonly status: 'complete'; readonly model: CarLiftNormalizedModel; readonly missingFields: readonly [] }
  | { readonly status: 'invalid'; readonly model: CarLiftNormalizedModel; readonly missingFields: readonly CarLiftModelField[]; readonly invalidFields: readonly CarLiftModelField[] }

const positive = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value > 0
const nonNegative = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value >= 0

function centeredRectangle(widthMm: Millimetres, depthMm: Millimetres): CarPlanRectangleMm {
  return {
    minX: millimetres(-widthMm / 2), maxX: millimetres(widthMm / 2),
    minZ: millimetres(-depthMm / 2), maxZ: millimetres(depthMm / 2),
  }
}

function normalizeLevels(configuration: CarLiftPlanningConfiguration): {
  readonly levels: readonly CarLevelModel[]; readonly missing: readonly CarLiftModelField[]; readonly invalid: readonly CarLiftModelField[]
} {
  const normalized = normalizeLandings(configuration, false)
  if (configuration.levelElevationsMm || configuration.landingSettings) {
    return { levels: normalized.levels,
      missing: normalized.issues.some((i) => i.code === 'missing-elevation') ? ['levelElevationsMm'] : [],
      invalid: normalized.issues.some((i) => i.status === 'invalid' &&
        ['invalid-elevation-order', 'invalid-stop-count', 'inconsistent-stop-references'].includes(i.code)) ? ['levelElevationsMm'] : [] }
  }
  if (configuration.stopCount === undefined) {
    return { levels: [] as CarLevelModel[], missing: ['stopCount'] as CarLiftModelField[], invalid: [] as CarLiftModelField[] }
  }
  if (!Number.isInteger(configuration.stopCount) || configuration.stopCount <= 0) {
    return { levels: [] as CarLevelModel[], missing: [] as CarLiftModelField[], invalid: ['stopCount'] as CarLiftModelField[] }
  }
  const heights = configuration.storeyHeightsMm
  if (!heights) {
    return { levels: [] as CarLevelModel[], missing: ['storeyHeightsMm'] as CarLiftModelField[], invalid: [] as CarLiftModelField[] }
  }
  if (heights.length !== Math.max(0, configuration.stopCount - 1) || heights.some((height) => !positive(height))) {
    return { levels: [] as CarLevelModel[], missing: [] as CarLiftModelField[], invalid: ['storeyHeightsMm'] as CarLiftModelField[] }
  }
  return { levels: normalized.levels, missing: [], invalid: [] }
}

function rotate(localX: number, localZ: number, center: CarPlanPointMm, headingDegrees: number): CarPlanPointMm {
  const angle = headingDegrees * Math.PI / 180
  return {
    x: millimetres(center.x + localX * Math.cos(angle) + localZ * Math.sin(angle)),
    z: millimetres(center.z - localX * Math.sin(angle) + localZ * Math.cos(angle)),
  }
}

function boundsOf(points: readonly CarPlanPointMm[]): CarPlanRectangleMm {
  return {
    minX: millimetres(Math.min(...points.map((point) => point.x))),
    maxX: millimetres(Math.max(...points.map((point) => point.x))),
    minZ: millimetres(Math.min(...points.map((point) => point.z))),
    maxZ: millimetres(Math.max(...points.map((point) => point.z))),
  }
}

function normalizeVehicle(configuration: CarLiftPlanningConfiguration, baseY: Millimetres): NormalizedVehicleModel | undefined {
  const vehicle = configuration.vehicle
  if (!positive(vehicle?.widthMm) || !positive(vehicle?.lengthMm)) return undefined
  const position = configuration.vehiclePosition
  const positioned = position?.lateralOffsetMm !== undefined && position.longitudinalOffsetMm !== undefined &&
    position.headingDegrees !== undefined && Number.isFinite(position.headingDegrees)
  const center = positioned ? {
    x: position!.lateralOffsetMm!, z: position!.longitudinalOffsetMm!,
  } : undefined
  const footprint = center ? [
    rotate(-vehicle!.widthMm! / 2, -vehicle!.lengthMm! / 2, center, position!.headingDegrees!),
    rotate(vehicle!.widthMm! / 2, -vehicle!.lengthMm! / 2, center, position!.headingDegrees!),
    rotate(vehicle!.widthMm! / 2, vehicle!.lengthMm! / 2, center, position!.headingDegrees!),
    rotate(-vehicle!.widthMm! / 2, vehicle!.lengthMm! / 2, center, position!.headingDegrees!),
  ] : undefined
  const planBounds = footprint ? boundsOf(footprint) : undefined
  const bounds = planBounds ? {
    ...planBounds,
    minY: baseY,
    maxY: millimetres(baseY + (positive(vehicle?.heightMm) ? vehicle!.heightMm! : 0)),
  } : undefined
  const completeWheelGeometry = center && positive(vehicle?.wheelbaseMm) && positive(vehicle?.trackWidthMm) &&
    nonNegative(vehicle?.rearOverhangMm)
  const rearAxle = completeWheelGeometry ? -vehicle!.lengthMm! / 2 + vehicle!.rearOverhangMm! : undefined
  const wheelContactPoints = rearAxle === undefined ? undefined : [
    rotate(-vehicle!.trackWidthMm! / 2, rearAxle, center!, position!.headingDegrees!),
    rotate(vehicle!.trackWidthMm! / 2, rearAxle, center!, position!.headingDegrees!),
    rotate(-vehicle!.trackWidthMm! / 2, rearAxle + vehicle!.wheelbaseMm!, center!, position!.headingDegrees!),
    rotate(vehicle!.trackWidthMm! / 2, rearAxle + vehicle!.wheelbaseMm!, center!, position!.headingDegrees!),
  ]
  const centerline = center ? [
    rotate(0, -vehicle!.lengthMm! / 2, center, position!.headingDegrees!),
    rotate(0, vehicle!.lengthMm! / 2, center, position!.headingDegrees!),
  ] as const : undefined
  return {
    widthMm: vehicle!.widthMm!, lengthMm: vehicle!.lengthMm!,
    heightMm: positive(vehicle?.heightMm) ? vehicle!.heightMm : undefined,
    massKg: positive(vehicle?.massKg) ? vehicle!.massKg : undefined,
    frontOverhangMm: nonNegative(vehicle?.frontOverhangMm) ? vehicle!.frontOverhangMm : undefined,
    rearOverhangMm: nonNegative(vehicle?.rearOverhangMm) ? vehicle!.rearOverhangMm : undefined,
    wheelbaseMm: positive(vehicle?.wheelbaseMm) ? vehicle!.wheelbaseMm : undefined,
    trackWidthMm: positive(vehicle?.trackWidthMm) ? vehicle!.trackWidthMm : undefined,
    headingDegrees: positioned ? position!.headingDegrees : undefined,
    center, footprint, bounds, wheelContactPoints, centerline,
  }
}

function normalizeApproach(id: NormalizedCarApproachEnvelope['id'], envelope: CarLiftApproachEnvelope | undefined,
  baseY: Millimetres): NormalizedCarApproachEnvelope | undefined {
  if (!positive(envelope?.widthMm) || !positive(envelope?.lengthMm) || envelope?.lateralOffsetMm === undefined ||
    envelope.longitudinalOffsetMm === undefined || envelope.headingDegrees === undefined || !Number.isFinite(envelope.headingDegrees)) return undefined
  const widthMm = envelope.widthMm!
  const lengthMm = envelope.lengthMm!
  const heightMm = positive(envelope.heightMm) ? envelope.heightMm! : undefined
  const headingDegrees = envelope.headingDegrees
  const center = { x: envelope.lateralOffsetMm, z: envelope.longitudinalOffsetMm }
  const corners = [
    rotate(-widthMm / 2, -lengthMm / 2, center, headingDegrees),
    rotate(widthMm / 2, -lengthMm / 2, center, headingDegrees),
    rotate(widthMm / 2, lengthMm / 2, center, headingDegrees),
    rotate(-widthMm / 2, lengthMm / 2, center, headingDegrees),
  ]
  const plan = boundsOf(corners)
  return {
    id,
    bounds: { ...plan, minY: baseY, maxY: millimetres(baseY + (heightMm ?? 0)) },
    center,
    widthMm,
    lengthMm,
    heightMm,
    headingDegrees,
  }
}

export function createCarLiftNormalizedModel(configuration: CarLiftPlanningConfiguration): CarLiftNormalizationResult {
  const missing: CarLiftModelField[] = []
  const invalid: CarLiftModelField[] = []
  const requirePositive = (field: CarLiftModelField, value: number | undefined) => {
    if (value === undefined) missing.push(field)
    else if (!positive(value)) invalid.push(field)
  }
  requirePositive('platformWidthMm', configuration.platformWidthMm)
  requirePositive('platformDepthMm', configuration.platformDepthMm)
  requirePositive('usableHeightMm', configuration.usableHeightMm)
  requirePositive('doorClearWidthMm', configuration.doorClearWidthMm)
  requirePositive('doorClearHeightMm', configuration.doorClearHeightMm)
  requirePositive('shaftWidthMm', configuration.shaftWidthMm)
  requirePositive('shaftDepthMm', configuration.shaftDepthMm)
  if (configuration.pitDepthMm === undefined) missing.push('pitDepthMm')
  else if (!nonNegative(configuration.pitDepthMm)) invalid.push('pitDepthMm')
  if (configuration.headroomMm === undefined) missing.push('headroomMm')
  else if (!nonNegative(configuration.headroomMm)) invalid.push('headroomMm')
  if (configuration.vehicleLoadingDirection === undefined) missing.push('vehicleLoadingDirection')

  if (configuration.vehicle) {
    if (!positive(configuration.vehicle.widthMm) || !positive(configuration.vehicle.lengthMm) ||
      (configuration.vehicle.heightMm !== undefined && !positive(configuration.vehicle.heightMm)) ||
      (configuration.vehicle.massKg !== undefined && !positive(configuration.vehicle.massKg)) ||
      (configuration.vehicle.frontOverhangMm !== undefined && !nonNegative(configuration.vehicle.frontOverhangMm)) ||
      (configuration.vehicle.rearOverhangMm !== undefined && !nonNegative(configuration.vehicle.rearOverhangMm)) ||
      (configuration.vehicle.wheelbaseMm !== undefined && !positive(configuration.vehicle.wheelbaseMm)) ||
      (configuration.vehicle.trackWidthMm !== undefined && !positive(configuration.vehicle.trackWidthMm))) invalid.push('vehicle')
  }
  const inspectApproach = (field: 'entryApproachEnvelope' | 'exitApproachEnvelope' | 'vehicleSweptEnvelope',
    envelope: CarLiftApproachEnvelope | undefined) => {
    if (envelope && ((envelope.widthMm !== undefined && !positive(envelope.widthMm)) ||
      (envelope.lengthMm !== undefined && !positive(envelope.lengthMm)) ||
      (envelope.heightMm !== undefined && !positive(envelope.heightMm)))) invalid.push(field)
  }
  inspectApproach('entryApproachEnvelope', configuration.entryApproachEnvelope)
  inspectApproach('exitApproachEnvelope', configuration.exitApproachEnvelope)
  inspectApproach('vehicleSweptEnvelope', configuration.vehicleSweptEnvelope)
  if (configuration.doorPassageEnvelope &&
    ((configuration.doorPassageEnvelope.clearWidthMm !== undefined && !positive(configuration.doorPassageEnvelope.clearWidthMm)) ||
      (configuration.doorPassageEnvelope.clearHeightMm !== undefined && !positive(configuration.doorPassageEnvelope.clearHeightMm)) ||
      (configuration.doorPassageEnvelope.depthMm !== undefined && !nonNegative(configuration.doorPassageEnvelope.depthMm)))) {
    invalid.push('doorPassageEnvelope')
  }

  const levels = normalizeLevels(configuration)
  missing.push(...levels.missing)
  invalid.push(...levels.invalid)
  const baseY = levels.levels[0]?.elevationMm ?? millimetres(0)
  const platformPlan = positive(configuration.platformWidthMm) && positive(configuration.platformDepthMm)
    ? centeredRectangle(configuration.platformWidthMm!, configuration.platformDepthMm!) : undefined
  const platform = platformPlan && positive(configuration.usableHeightMm) ? {
    ...platformPlan, minY: baseY, maxY: millimetres(baseY + configuration.usableHeightMm!),
  } : undefined
  const shaftPlan = positive(configuration.shaftWidthMm) && positive(configuration.shaftDepthMm)
    ? centeredRectangle(configuration.shaftWidthMm!, configuration.shaftDepthMm!) : undefined
  const highest = levels.levels.at(-1)?.elevationMm
  const shaft = shaftPlan && highest !== undefined && positive(configuration.usableHeightMm) &&
    nonNegative(configuration.pitDepthMm) && nonNegative(configuration.headroomMm) ? {
      ...shaftPlan,
      minY: millimetres(baseY - configuration.pitDepthMm!),
      maxY: millimetres(highest + configuration.usableHeightMm! + configuration.headroomMm!),
    } : undefined
  const movingEnvelope = platformPlan && highest !== undefined && positive(configuration.usableHeightMm) ? {
    ...platformPlan, minY: baseY, maxY: millimetres(highest + configuration.usableHeightMm!),
  } : undefined
  const entrances: CarEntranceModel[] = []
  if (configuration.frontAccess === true && positive(configuration.doorClearWidthMm) && positive(configuration.doorClearHeightMm)) {
    entrances.push({ id: 'car-front', side: 'front', clearWidthMm: configuration.doorClearWidthMm!, clearHeightMm: configuration.doorClearHeightMm! })
  }
  if (configuration.rearAccess === true && positive(configuration.doorClearWidthMm) && positive(configuration.doorClearHeightMm)) {
    entrances.push({ id: 'car-rear', side: 'rear', clearWidthMm: configuration.doorClearWidthMm!, clearHeightMm: configuration.doorClearHeightMm! })
  }
  if (configuration.vehiclePosition && (configuration.vehiclePosition.lateralOffsetMm === undefined ||
    configuration.vehiclePosition.longitudinalOffsetMm === undefined || configuration.vehiclePosition.headingDegrees === undefined)) {
    missing.push('vehiclePosition')
  }
  const model: CarLiftNormalizedModel = {
    family: 'car', sourceSchemaVersion: configuration.schemaVersion, projectName: configuration.projectName,
    drive: normalizeCarrierDrive(configuration.drive,configuration.safety,{levels:levels.levels,shaft}),
    nominalSpeedMetresPerSecond: configuration.nominalSpeedMetresPerSecond,
    platform, shaft, movingEnvelope, entrances, levels: levels.levels,
    landingIssues: normalizeLandings(configuration, false).issues,
    vehicle: normalizeVehicle(configuration, baseY),
    entryApproachEnvelope: normalizeApproach('car-entry-approach', configuration.entryApproachEnvelope, baseY),
    exitApproachEnvelope: normalizeApproach('car-exit-approach', configuration.exitApproachEnvelope, baseY),
    vehicleSweptEnvelope: normalizeApproach('car-vehicle-sweep', configuration.vehicleSweptEnvelope, baseY),
    doorPassageEnvelope: configuration.doorPassageEnvelope,
    guideSystem: configuration.guideSystem?.orientation && positive(configuration.guideSystem.spacingMm)
      ? { orientation: configuration.guideSystem.orientation, spacingMm: configuration.guideSystem.spacingMm! } : undefined,
    vehicleLoadingDirection: configuration.vehicleLoadingDirection,
    throughCar: configuration.throughCar, frontAccess: configuration.frontAccess, rearAccess: configuration.rearAccess,
  }
  const withMechanics = { ...model, mechanical: normalizeCarrierMechanics(configuration.mechanical, model) }
  if (invalid.length) return { status: 'invalid', model: withMechanics, missingFields: [...new Set(missing)], invalidFields: [...new Set(invalid)] }
  const hasGeometry = Boolean(platform || shaft || entrances.length || levels.levels.length || model.vehicle)
  if (!hasGeometry) return { status: 'empty', missingFields: [...new Set(missing)] }
  if (missing.length) return { status: 'partial', model: withMechanics, missingFields: [...new Set(missing)] }
  return { status: 'complete', model: withMechanics, missingFields: [] }
}
