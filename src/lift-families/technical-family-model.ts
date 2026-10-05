import {
  LIFT_FAMILIES,
  carLiftPlanningConfigurationSchema,
  createCarLiftNormalizedModel,
  createGoodsLiftNormalizedModel,
  goodsLiftPlanningConfigurationSchema,
  type GoodsLiftNormalizationResult,
  type RegisteredLiftConfiguration,
  type RegisteredLiftFamily,
} from '../elevator'
import { validateGoodsLiftSpatialGeometry, type GoodsSpatialValidationResult } from '../collision/goods-lift-spatial-validation'
import { createGoodsLiftSceneModel, type GoodsLiftSceneModel } from '../elevator/goods/goods-lift-scene-model'
import { validateCarLiftSpatialGeometry, type CarSpatialValidationResult } from '../collision/car-lift-spatial-validation'
import { createCarLiftSceneModel, type CarLiftSceneModel } from '../elevator/car/car-lift-scene-model'
import type { CarLiftNormalizationResult } from '../elevator/car/car-lift-model'
import { createLiftGeometryPlanningInput, type PassengerGeometryPlanningInput } from '../three/geometry/lift-geometry-planning-input'

export type LiftFamilyTechnicalModel =
  | {
      readonly status: 'available'
      readonly family: typeof LIFT_FAMILIES.passenger
      readonly planning: PassengerGeometryPlanningInput
    }
  | {
      readonly status: 'available'
      readonly family: typeof LIFT_FAMILIES.goods
      readonly normalized: GoodsLiftNormalizationResult
      readonly validation: GoodsSpatialValidationResult
      readonly scene?: GoodsLiftSceneModel
    }
  | {
      readonly status: 'available'
      readonly family: typeof LIFT_FAMILIES.car
      readonly normalized: CarLiftNormalizationResult
      readonly validation: CarSpatialValidationResult
      readonly scene?: CarLiftSceneModel
    }
  | {
      readonly status: 'unavailable'
      readonly family: Exclude<RegisteredLiftFamily, typeof LIFT_FAMILIES.passenger | typeof LIFT_FAMILIES.goods | typeof LIFT_FAMILIES.car>
      readonly reason: 'family-capability-unavailable'
    }

/** Family-discriminated technical entry point. Unsupported families remain explicit. */
export function createLiftFamilyTechnicalModel(configuration: RegisteredLiftConfiguration): LiftFamilyTechnicalModel {
  if (configuration.family === LIFT_FAMILIES.passenger) {
    const planning = createLiftGeometryPlanningInput(configuration)
    if (!planning) throw new Error('Passenger configuration passed structural validation but could not be normalized.')
    return { status: 'available', family: LIFT_FAMILIES.passenger, planning }
  }
  if (configuration.family === LIFT_FAMILIES.goods) {
    const parsed = goodsLiftPlanningConfigurationSchema.parse(configuration)
    const normalized = createGoodsLiftNormalizedModel(parsed)
    const validation = validateGoodsLiftSpatialGeometry(normalized)
    const scene = normalized.status === 'empty' ? undefined : createGoodsLiftSceneModel(normalized.model)
    return { status: 'available', family: LIFT_FAMILIES.goods, normalized, validation, scene }
  }
  if (configuration.family === LIFT_FAMILIES.car) {
    const parsed = carLiftPlanningConfigurationSchema.parse(configuration)
    const normalized = createCarLiftNormalizedModel(parsed)
    const validation = validateCarLiftSpatialGeometry(normalized)
    const scene = normalized.status === 'empty' ? undefined : createCarLiftSceneModel(normalized.model)
    return { status: 'available', family: LIFT_FAMILIES.car, normalized, validation, scene }
  }
  return { status: 'unavailable', family: configuration.family, reason: 'family-capability-unavailable' }
}
