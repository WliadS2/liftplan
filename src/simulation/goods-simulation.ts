import { metres } from '../engineering'
import type { GoodsLiftNormalizationResult } from '../elevator/goods/goods-lift-model'
import type { GoodsSpatialValidationResult } from '../collision/goods-lift-spatial-validation'
import { calculateVerticalTravelDuration } from './vertical-travel'
import { PLATFORM_VISUALIZATION_TIMING as GOODS_VISUALIZATION_TIMING,
  type PlatformSimulationModel as GoodsSimulationModel, type PlatformSimulationModelResult as GoodsSimulationModelResult,
  type PlatformVisualizationTiming as GoodsVisualizationTiming } from './platform-simulation'
export { PLATFORM_VISUALIZATION_TIMING as GOODS_VISUALIZATION_TIMING,
  createPlatformSimulationController as createGoodsSimulationController,
  createInitialPlatformSimulationState as createInitialGoodsSimulationState,
  dispatchPlatformSimulationCommand as dispatchGoodsSimulationCommand,
  advancePlatformSimulation as advanceGoodsSimulation,
  createPlatformSimulationPose as createGoodsSimulationPose } from './platform-simulation'
export type { PlatformSimulationModel as GoodsSimulationModel, PlatformSimulationModelResult as GoodsSimulationModelResult,
  PlatformVisualizationTiming as GoodsVisualizationTiming, PlatformSimulationController as GoodsSimulationController,
  PlatformSimulationState as GoodsSimulationState, PlatformSimulationPose as GoodsSimulationPose,
  PlatformSimulationPhase as GoodsSimulationPhase, PlatformSimulationIssue as GoodsSimulationIssue,
  PlatformSimulationCommand as GoodsSimulationCommand, PlatformSimulationResult as GoodsSimulationResult,
  PlatformSimulationCapabilityName as GoodsSimulationCapabilityName } from './platform-simulation'

export function createGoodsSimulationModel(normalized: GoodsLiftNormalizationResult,
  validation: GoodsSpatialValidationResult, timing: GoodsVisualizationTiming = GOODS_VISUALIZATION_TIMING): GoodsSimulationModelResult {
  if (![timing.doorSeconds].every((v) => Number.isFinite(v) && v > 0)) {
    return { status: 'invalid', issues: [{ code: 'invalid-timing', path: 'visualization.timing' }] }
  }
  if (normalized.status === 'empty') return { status: 'unavailable', issues: [{ code: 'planning-incomplete', path: 'platform.levels' }] }
  const model = normalized.model
  const speed = calculateVerticalTravelDuration(metres(0), metres(0), model.nominalSpeedMetresPerSecond)
  if (speed.status !== 'available') return { status: speed.status === 'unknown' ? 'unavailable' : 'invalid',
    issues: [{ code: speed.status === 'unknown' ? 'planning-incomplete' : 'invalid-timing', path: speed.path }] }
  if (normalized.status === 'invalid' && normalized.invalidFields.some((field) => [
    'platformWidthMm', 'platformDepthMm', 'platformHeightMm', 'shaftWidthMm', 'shaftDepthMm',
    'pitDepthMm', 'headroomMm', 'stopCount', 'storeyHeightsMm', 'levelElevationsMm',
  ].includes(field))) return { status: 'invalid', issues: [{ code: 'geometric-conflict', path: 'planning.geometry' }] }
  if (!model.platform || !model.shaft || !model.movingEnvelope || model.levels.length < 2) {
    return { status: 'unavailable', issues: [{ code: 'planning-incomplete', path: 'platform.shaft.levels' }] }
  }
  const conflicts = validation.issues.filter((issue) => issue.blocksPlatformTravel)
  // Loads are carried, not simulated independently. Test their actual swept bounds
  // against the declared shaft rather than blanket-blocking an unrelated load-fit rule.
  const topOffset = model.levels.at(-1)!.elevationMm - model.platform.minY
  const loadConflict = [model.pallet, model.rollContainer, model.forkliftEnvelope].some((load) => load && (
    load.minX < model.shaft!.minX || load.maxX > model.shaft!.maxX ||
    load.minZ < model.shaft!.minZ || load.maxZ > model.shaft!.maxZ ||
    load.minY < model.shaft!.minY || load.maxY + topOffset > model.shaft!.maxY ||
    (model.guideSystem && [-model.guideSystem.spacingMm/2, model.guideSystem.spacingMm/2].some((axis) =>
      model.guideSystem!.orientation === 'x'
        ? axis > load.minX && axis < load.maxX && load.minZ < 0 && load.maxZ > 0
        : axis > load.minZ && axis < load.maxZ && load.minX < 0 && load.maxX > 0))
  ))
  const doorConflict = model.entrances.some((entrance) =>
    entrance.widthMm > model.shaft!.maxX - model.shaft!.minX ||
    model.levels.at(-1)!.elevationMm + entrance.heightMm > model.shaft!.maxY)
  if (conflicts.length || loadConflict || doorConflict) return { status: 'invalid', issues: conflicts.length
    ? conflicts.map((issue) => ({ code: 'geometric-conflict' as const, path: issue.code }))
    : [{ code: 'geometric-conflict', path: loadConflict ? 'loads.swept-geometry' : 'doors.shaft-sweep' }] }
  const door = (side: 'front' | 'rear') => model.entrances.some((entrance) => entrance.side === side &&
    entrance.widthMm <= model.platform!.maxX - model.platform!.minX &&
    entrance.heightMm <= model.platform!.maxY - model.platform!.minY)
  const capabilities: GoodsSimulationModel['capabilities'] = {
    platformMovement: { available: true, path: 'platform.levels' },
    frontDoorMovement: { available: door('front'), path: 'entrances.front' },
    rearDoorMovement: { available: door('rear'), path: 'entrances.rear' },
    landingDoorMovement: { available: door('front') || door('rear'), path: 'entrances.levels' },
    loadEnvelopeMovement: { available: !!(model.pallet || model.rollContainer || model.forkliftEnvelope), path: 'loads' },
  }
  return { status: 'available', availability: capabilities.landingDoorMovement.available &&
    model.frontAccess !== undefined && model.rearAccess !== undefined &&
    (!model.frontAccess || door('front')) && (!model.rearAccess || door('rear')) ? 'complete' : 'partial',
  model: { family: 'goods', nominalSpeedMetresPerSecond: model.nominalSpeedMetresPerSecond, levels: model.levels, referenceFloorMm: model.platform.minY,
    capabilities, timing, unavailableBehaviors: ['driveSimulation', 'counterweightSimulation', 'ropeSimulation', 'safetyGearSimulation'] } }
}
