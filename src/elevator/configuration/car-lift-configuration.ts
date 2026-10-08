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
import { updateUniformLevelIntervals } from './uniform-level-update'
import { carrierMechanicalPlanningSchema, type CarrierMechanicalPlanning } from './carrier-mechanical-planning'
import { carrierDrivePlanningSchema, carrierSafetyPlanningSchema, type CarrierDrivePlanning, type CarrierSafetyPlanning } from './carrier-drive-planning'

export const CAR_LIFT_PLANNING_SCHEMA_VERSION = 'car-lift-planning-v1' as const
export const VEHICLE_LOADING_DIRECTIONS = ['shaft-x', 'shaft-z'] as const
export type VehicleLoadingDirection = (typeof VEHICLE_LOADING_DIRECTIONS)[number]

export interface CarLiftVehicleEnvelope {
  readonly widthMm?: Millimetres
  readonly lengthMm?: Millimetres
  readonly heightMm?: Millimetres
  readonly massKg?: Kilograms
  readonly frontOverhangMm?: Millimetres
  readonly rearOverhangMm?: Millimetres
  readonly wheelbaseMm?: Millimetres
  readonly trackWidthMm?: Millimetres
}

export interface CarLiftVehiclePosition {
  readonly longitudinalOffsetMm?: Millimetres
  readonly lateralOffsetMm?: Millimetres
  readonly headingDegrees?: number
}

export interface CarLiftApproachEnvelope {
  readonly widthMm?: Millimetres
  readonly lengthMm?: Millimetres
  readonly heightMm?: Millimetres
  readonly longitudinalOffsetMm?: Millimetres
  readonly lateralOffsetMm?: Millimetres
  readonly headingDegrees?: number
}

export interface CarLiftDoorPassageEnvelope {
  readonly clearWidthMm?: Millimetres
  readonly clearHeightMm?: Millimetres
  readonly depthMm?: Millimetres
}

export interface CarLiftPlanningConfiguration
  extends LiftConfiguration<typeof LIFT_FAMILIES.car, typeof CAR_LIFT_PLANNING_SCHEMA_VERSION> {
  readonly projectName: string
  readonly drive?: CarrierDrivePlanning
  readonly safety?: CarrierSafetyPlanning
  readonly mechanical?: CarrierMechanicalPlanning
  readonly ratedLoadKg?: Kilograms
  readonly stopCount?: number
  readonly nominalSpeedMetresPerSecond?: MetresPerSecond
  readonly platformWidthMm?: Millimetres
  readonly platformDepthMm?: Millimetres
  readonly usableHeightMm?: Millimetres
  readonly vehicleLoadingDirection?: VehicleLoadingDirection
  readonly frontAccess?: boolean
  readonly rearAccess?: boolean
  readonly throughCar?: boolean
  readonly doorClearWidthMm?: Millimetres
  readonly doorClearHeightMm?: Millimetres
  readonly shaftWidthMm?: Millimetres
  readonly shaftDepthMm?: Millimetres
  readonly pitDepthMm?: Millimetres
  readonly headroomMm?: Millimetres
  readonly storeyHeightsMm?: readonly Millimetres[]
  readonly levelElevationsMm?: readonly Millimetres[]
  readonly vehicle?: CarLiftVehicleEnvelope
  readonly vehiclePosition?: CarLiftVehiclePosition
  readonly entryApproachEnvelope?: CarLiftApproachEnvelope
  readonly exitApproachEnvelope?: CarLiftApproachEnvelope
  readonly vehicleSweptEnvelope?: CarLiftApproachEnvelope
  readonly doorPassageEnvelope?: CarLiftDoorPassageEnvelope
  readonly guideSystem?: {
    readonly orientation?: 'x' | 'z'
    readonly spacingMm?: Millimetres
  }
}

const finite = z.number().finite()
const optionalMm = finite.optional().transform((value) => value === undefined ? undefined : millimetres(value))
const optionalKg = finite.optional().transform((value) => value === undefined ? undefined : kilograms(value))
const spatialEnvelopeSchema = z.object({
  widthMm: optionalMm,
  lengthMm: optionalMm,
  heightMm: optionalMm,
  longitudinalOffsetMm: optionalMm,
  lateralOffsetMm: optionalMm,
  headingDegrees: finite.optional(),
}).strict()

export const carLiftPlanningConfigurationSchema = z.object({
  family: z.literal(LIFT_FAMILIES.car),
  schemaVersion: z.literal(CAR_LIFT_PLANNING_SCHEMA_VERSION),
  projectName: z.string(),
  drive: carrierDrivePlanningSchema.optional(),
  safety: carrierSafetyPlanningSchema.optional(),
  mechanical: carrierMechanicalPlanningSchema.optional(),
  ratedLoadKg: optionalKg,
  stopCount: z.number().int().optional(),
  nominalSpeedMetresPerSecond: finite.optional().transform((value) =>
    value === undefined ? undefined : metresPerSecond(value)),
  platformWidthMm: optionalMm,
  platformDepthMm: optionalMm,
  usableHeightMm: optionalMm,
  vehicleLoadingDirection: z.enum(VEHICLE_LOADING_DIRECTIONS).optional(),
  frontAccess: z.boolean().optional(),
  rearAccess: z.boolean().optional(),
  throughCar: z.boolean().optional(),
  doorClearWidthMm: optionalMm,
  doorClearHeightMm: optionalMm,
  shaftWidthMm: optionalMm,
  shaftDepthMm: optionalMm,
  pitDepthMm: optionalMm,
  headroomMm: optionalMm,
  storeyHeightsMm: z.array(finite.transform(millimetres)).readonly().optional(),
  levelElevationsMm: z.array(finite.transform(millimetres)).readonly().optional(),
  vehicle: z.object({
    widthMm: optionalMm,
    lengthMm: optionalMm,
    heightMm: optionalMm,
    massKg: optionalKg,
    frontOverhangMm: optionalMm,
    rearOverhangMm: optionalMm,
    wheelbaseMm: optionalMm,
    trackWidthMm: optionalMm,
  }).strict().optional(),
  vehiclePosition: z.object({
    longitudinalOffsetMm: optionalMm,
    lateralOffsetMm: optionalMm,
    headingDegrees: finite.optional(),
  }).strict().optional(),
  entryApproachEnvelope: spatialEnvelopeSchema.optional(),
  exitApproachEnvelope: spatialEnvelopeSchema.optional(),
  vehicleSweptEnvelope: spatialEnvelopeSchema.optional(),
  doorPassageEnvelope: z.object({
    clearWidthMm: optionalMm,
    clearHeightMm: optionalMm,
    depthMm: optionalMm,
  }).strict().optional(),
  guideSystem: z.object({
    orientation: z.enum(['x', 'z']).optional(),
    spacingMm: optionalMm,
  }).strict().optional(),
}).strict()

export type CarLiftPlanningConfigurationUpdate = Partial<Omit<CarLiftPlanningConfiguration, 'family' | 'schemaVersion'>>

export function createCarLiftPlanningConfiguration(projectName: string): CarLiftPlanningConfiguration {
  return { family: LIFT_FAMILIES.car, schemaVersion: CAR_LIFT_PLANNING_SCHEMA_VERSION, projectName }
}

export function updateCarLiftPlanningConfiguration(
  configuration: CarLiftPlanningConfiguration,
  update: CarLiftPlanningConfigurationUpdate,
): CarLiftPlanningConfiguration {
  return updateUniformLevelIntervals(configuration, update)
}

export function createCenteredVehiclePosition(headingDegrees = 0): CarLiftVehiclePosition {
  return { longitudinalOffsetMm: millimetres(0), lateralOffsetMm: millimetres(0), headingDegrees }
}
