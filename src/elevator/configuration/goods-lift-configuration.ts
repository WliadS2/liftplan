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

export const GOODS_PLANNING_SCHEMA_VERSION = 'goods-planning-v1' as const
export const GOODS_LOAD_CATEGORIES = [
  'general-goods',
  'palletized',
  'roll-container',
  'forklift-assisted',
  'mixed',
] as const
export type GoodsLoadCategory = (typeof GOODS_LOAD_CATEGORIES)[number]

export interface GoodsLoadEnvelope {
  readonly widthMm?: Millimetres
  readonly depthMm?: Millimetres
  readonly heightMm?: Millimetres
}

export interface GoodsGuidePlanning {
  readonly orientation?: 'x' | 'z'
  readonly spacingMm?: Millimetres
}

export interface GoodsLiftPlanningConfiguration
  extends LiftConfiguration<typeof LIFT_FAMILIES.goods, typeof GOODS_PLANNING_SCHEMA_VERSION> {
  readonly projectName: string
  readonly ratedLoadKg?: Kilograms
  readonly stopCount?: number
  readonly nominalSpeedMetresPerSecond?: MetresPerSecond
  readonly platformWidthMm?: Millimetres
  readonly platformDepthMm?: Millimetres
  readonly platformHeightMm?: Millimetres
  readonly doorWidthMm?: Millimetres
  readonly doorHeightMm?: Millimetres
  readonly shaftWidthMm?: Millimetres
  readonly shaftDepthMm?: Millimetres
  readonly pitDepthMm?: Millimetres
  readonly headroomMm?: Millimetres
  readonly storeyHeightsMm?: readonly Millimetres[]
  readonly levelElevationsMm?: readonly Millimetres[]
  readonly throughCar?: boolean
  readonly frontAccess?: boolean
  readonly rearAccess?: boolean
  readonly loadCategory?: GoodsLoadCategory
  readonly pallet?: GoodsLoadEnvelope
  readonly rollContainer?: GoodsLoadEnvelope
  readonly forkliftEnvelope?: GoodsLoadEnvelope
  readonly guideSystem?: GoodsGuidePlanning
  readonly mechanical?: CarrierMechanicalPlanning
}

const finiteNumber = z.number().finite()
const optionalMillimetres = finiteNumber.optional().transform((value) =>
  value === undefined ? undefined : millimetres(value),
)
const loadEnvelopeSchema = z.object({
  widthMm: optionalMillimetres,
  depthMm: optionalMillimetres,
  heightMm: optionalMillimetres,
}).strict()

export const goodsLiftPlanningConfigurationSchema = z.object({
  family: z.literal(LIFT_FAMILIES.goods),
  schemaVersion: z.literal(GOODS_PLANNING_SCHEMA_VERSION),
  projectName: z.string(),
  ratedLoadKg: finiteNumber.optional().transform((value) => value === undefined ? undefined : kilograms(value)),
  stopCount: z.number().int().optional(),
  nominalSpeedMetresPerSecond: finiteNumber.optional().transform((value) =>
    value === undefined ? undefined : metresPerSecond(value),
  ),
  platformWidthMm: optionalMillimetres,
  platformDepthMm: optionalMillimetres,
  platformHeightMm: optionalMillimetres,
  doorWidthMm: optionalMillimetres,
  doorHeightMm: optionalMillimetres,
  shaftWidthMm: optionalMillimetres,
  shaftDepthMm: optionalMillimetres,
  pitDepthMm: optionalMillimetres,
  headroomMm: optionalMillimetres,
  storeyHeightsMm: z.array(finiteNumber.transform(millimetres)).readonly().optional(),
  levelElevationsMm: z.array(finiteNumber.transform(millimetres)).readonly().optional(),
  throughCar: z.boolean().optional(),
  frontAccess: z.boolean().optional(),
  rearAccess: z.boolean().optional(),
  loadCategory: z.enum(GOODS_LOAD_CATEGORIES).optional(),
  pallet: loadEnvelopeSchema.optional(),
  rollContainer: loadEnvelopeSchema.optional(),
  forkliftEnvelope: loadEnvelopeSchema.optional(),
  guideSystem: z.object({
    orientation: z.enum(['x', 'z']).optional(),
    spacingMm: optionalMillimetres,
  }).strict().optional(),
  mechanical: carrierMechanicalPlanningSchema.optional(),
}).strict()

export type GoodsLiftPlanningConfigurationUpdate = Partial<
  Omit<GoodsLiftPlanningConfiguration, 'family' | 'schemaVersion'>
>

export function createGoodsLiftPlanningConfiguration(projectName: string): GoodsLiftPlanningConfiguration {
  return {
    family: LIFT_FAMILIES.goods,
    schemaVersion: GOODS_PLANNING_SCHEMA_VERSION,
    projectName,
  }
}

export function updateGoodsLiftPlanningConfiguration(
  configuration: GoodsLiftPlanningConfiguration,
  update: GoodsLiftPlanningConfigurationUpdate,
): GoodsLiftPlanningConfiguration {
  return updateUniformLevelIntervals(configuration, update)
}
