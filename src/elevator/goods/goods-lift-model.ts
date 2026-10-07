import { millimetres, type Millimetres, type MetresPerSecond } from '../../engineering'
import { normalizeCarrierMechanics, type CarrierMechanicalModel } from '../models/carrier-mechanical-model'
import type {
  GoodsLiftPlanningConfiguration,
  GoodsLoadEnvelope,
} from '../configuration/goods-lift-configuration'

export type GoodsLiftModelField =
  | 'platformWidthMm' | 'platformDepthMm' | 'platformHeightMm'
  | 'doorWidthMm' | 'doorHeightMm'
  | 'shaftWidthMm' | 'shaftDepthMm' | 'pitDepthMm' | 'headroomMm'
  | 'stopCount' | 'storeyHeightsMm' | 'levelElevationsMm'
  | 'frontAccess' | 'rearAccess' | 'throughCar'
  | 'pallet' | 'rollContainer' | 'forkliftEnvelope' | 'guideSystem'

export interface GoodsPlanRectangleMm {
  readonly minX: Millimetres
  readonly maxX: Millimetres
  readonly minZ: Millimetres
  readonly maxZ: Millimetres
}

export interface GoodsBoxMm extends GoodsPlanRectangleMm {
  readonly minY: Millimetres
  readonly maxY: Millimetres
}

export interface GoodsLoadBoxMm extends GoodsBoxMm {
  readonly heightKnown: boolean
}

export interface GoodsLevelModel {
  readonly id: string
  readonly index: number
  readonly elevationMm: Millimetres
}

export interface GoodsEntranceModel {
  readonly id: 'goods-front' | 'goods-rear'
  readonly side: 'front' | 'rear'
  readonly widthMm: Millimetres
  readonly heightMm: Millimetres
}

export interface GoodsLiftNormalizedModel {
  readonly nominalSpeedMetresPerSecond?: MetresPerSecond
  readonly family: 'goods'
  readonly mechanical?: CarrierMechanicalModel
  readonly sourceSchemaVersion: string
  readonly projectName: string
  readonly platform?: GoodsBoxMm
  readonly shaft?: GoodsBoxMm
  readonly movingEnvelope?: GoodsBoxMm
  readonly entrances: readonly GoodsEntranceModel[]
  readonly levels: readonly GoodsLevelModel[]
  readonly pallet?: GoodsLoadBoxMm
  readonly rollContainer?: GoodsLoadBoxMm
  readonly forkliftEnvelope?: GoodsLoadBoxMm
  readonly guideSystem?: {
    readonly orientation: 'x' | 'z'
    readonly spacingMm: Millimetres
  }
  readonly throughCar?: boolean
  readonly frontAccess?: boolean
  readonly rearAccess?: boolean
}

export type GoodsLiftNormalizationResult =
  | { readonly status: 'empty'; readonly missingFields: readonly GoodsLiftModelField[] }
  | { readonly status: 'partial'; readonly model: GoodsLiftNormalizedModel; readonly missingFields: readonly GoodsLiftModelField[] }
  | { readonly status: 'complete'; readonly model: GoodsLiftNormalizedModel; readonly missingFields: readonly [] }
  | { readonly status: 'invalid'; readonly model: GoodsLiftNormalizedModel; readonly missingFields: readonly GoodsLiftModelField[]; readonly invalidFields: readonly GoodsLiftModelField[] }

const positive = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value > 0
const nonNegative = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value >= 0

function centeredRectangle(widthMm: Millimetres, depthMm: Millimetres): GoodsPlanRectangleMm {
  return {
    minX: millimetres(-widthMm / 2), maxX: millimetres(widthMm / 2),
    minZ: millimetres(-depthMm / 2), maxZ: millimetres(depthMm / 2),
  }
}

function centeredLoadBox(envelope: GoodsLoadEnvelope | undefined, floorMm: Millimetres): GoodsLoadBoxMm | undefined {
  if (!positive(envelope?.widthMm) || !positive(envelope?.depthMm)) return undefined
  const plan = centeredRectangle(envelope!.widthMm!, envelope!.depthMm!)
  return {
    ...plan,
    minY: floorMm,
    maxY: millimetres(floorMm + (positive(envelope?.heightMm) ? envelope!.heightMm! : 0)),
    heightKnown: positive(envelope?.heightMm),
  }
}

function normalizeLevels(configuration: GoodsLiftPlanningConfiguration): {
  readonly levels: readonly GoodsLevelModel[]
  readonly missing: readonly GoodsLiftModelField[]
  readonly invalid: readonly GoodsLiftModelField[]
} {
  const explicit = configuration.levelElevationsMm
  if (explicit) {
    if (configuration.storeyHeightsMm) {
      return { levels: [], missing: [], invalid: ['levelElevationsMm', 'storeyHeightsMm'] }
    }
    if (!explicit.length || explicit.some((value, index) => !Number.isFinite(value) || (index > 0 && value <= explicit[index - 1]))) {
      return { levels: [], missing: [], invalid: ['levelElevationsMm'] }
    }
    if (configuration.stopCount !== undefined && configuration.stopCount !== explicit.length) {
      return { levels: [], missing: [], invalid: ['stopCount', 'levelElevationsMm'] }
    }
    return {
      levels: explicit.map((elevationMm, index) => ({ id: `level-${index + 1}`, index, elevationMm })),
      missing: [], invalid: [],
    }
  }
  if (configuration.stopCount === undefined) return { levels: [], missing: ['stopCount'], invalid: [] }
  if (!Number.isInteger(configuration.stopCount) || configuration.stopCount <= 0) {
    return { levels: [], missing: [], invalid: ['stopCount'] }
  }
  const heights = configuration.storeyHeightsMm
  if (!heights) return { levels: [], missing: ['storeyHeightsMm'], invalid: [] }
  if (heights.length !== Math.max(0, configuration.stopCount - 1) || heights.some((height) => !positive(height))) {
    return { levels: [], missing: [], invalid: ['storeyHeightsMm'] }
  }
  let elevation = millimetres(0)
  const levels: GoodsLevelModel[] = [{ id: 'level-1', index: 0, elevationMm: elevation }]
  heights.forEach((height, index) => {
    elevation = millimetres(elevation + height)
    levels.push({ id: `level-${index + 2}`, index: index + 1, elevationMm: elevation })
  })
  return { levels, missing: [], invalid: [] }
}

export function createGoodsLiftNormalizedModel(
  configuration: GoodsLiftPlanningConfiguration,
): GoodsLiftNormalizationResult {
  const missing: GoodsLiftModelField[] = []
  const invalid: GoodsLiftModelField[] = []
  const requirePositive = (field: GoodsLiftModelField, value: number | undefined) => {
    if (value === undefined) missing.push(field)
    else if (!positive(value)) invalid.push(field)
  }
  requirePositive('platformWidthMm', configuration.platformWidthMm)
  requirePositive('platformDepthMm', configuration.platformDepthMm)
  requirePositive('platformHeightMm', configuration.platformHeightMm)
  requirePositive('doorWidthMm', configuration.doorWidthMm)
  requirePositive('doorHeightMm', configuration.doorHeightMm)
  requirePositive('shaftWidthMm', configuration.shaftWidthMm)
  requirePositive('shaftDepthMm', configuration.shaftDepthMm)
  if (configuration.pitDepthMm === undefined) missing.push('pitDepthMm')
  else if (!nonNegative(configuration.pitDepthMm)) invalid.push('pitDepthMm')
  if (configuration.headroomMm === undefined) missing.push('headroomMm')
  else if (!nonNegative(configuration.headroomMm)) invalid.push('headroomMm')

  const levelResult = normalizeLevels(configuration)
  missing.push(...levelResult.missing)
  invalid.push(...levelResult.invalid)
  for (const field of ['pallet', 'rollContainer', 'forkliftEnvelope'] as const) {
    const envelope = configuration[field]
    if (envelope && Object.values(envelope).some((value) => value !== undefined && !positive(value))) invalid.push(field)
  }
  if (configuration.guideSystem?.spacingMm !== undefined && !positive(configuration.guideSystem.spacingMm)) {
    invalid.push('guideSystem')
  }

  const platformPlan = positive(configuration.platformWidthMm) && positive(configuration.platformDepthMm)
    ? centeredRectangle(configuration.platformWidthMm!, configuration.platformDepthMm!) : undefined
  const platform = platformPlan && positive(configuration.platformHeightMm) ? {
    ...platformPlan,
    minY: levelResult.levels[0]?.elevationMm ?? millimetres(0),
    maxY: millimetres((levelResult.levels[0]?.elevationMm ?? 0) + configuration.platformHeightMm!),
  } : undefined
  const shaftPlan = positive(configuration.shaftWidthMm) && positive(configuration.shaftDepthMm)
    ? centeredRectangle(configuration.shaftWidthMm!, configuration.shaftDepthMm!) : undefined
  const lowest = levelResult.levels[0]?.elevationMm
  const highest = levelResult.levels.at(-1)?.elevationMm
  const shaft = shaftPlan && lowest !== undefined && highest !== undefined && positive(configuration.platformHeightMm) &&
    nonNegative(configuration.pitDepthMm) && nonNegative(configuration.headroomMm) ? {
      ...shaftPlan,
      minY: millimetres(lowest - configuration.pitDepthMm!),
      maxY: millimetres(highest + configuration.platformHeightMm! + configuration.headroomMm!),
    } : undefined
  const movingEnvelope = platformPlan && lowest !== undefined && highest !== undefined && positive(configuration.platformHeightMm) ? {
    ...platformPlan,
    minY: lowest,
    maxY: millimetres(highest + configuration.platformHeightMm!),
  } : undefined

  const entrances: GoodsEntranceModel[] = []
  if (configuration.frontAccess === true && positive(configuration.doorWidthMm) && positive(configuration.doorHeightMm)) {
    entrances.push({ id: 'goods-front', side: 'front', widthMm: configuration.doorWidthMm!, heightMm: configuration.doorHeightMm! })
  }
  if (configuration.rearAccess === true && positive(configuration.doorWidthMm) && positive(configuration.doorHeightMm)) {
    entrances.push({ id: 'goods-rear', side: 'rear', widthMm: configuration.doorWidthMm!, heightMm: configuration.doorHeightMm! })
  }

  const model: GoodsLiftNormalizedModel = {
    family: 'goods',
    sourceSchemaVersion: configuration.schemaVersion,
    projectName: configuration.projectName,
    nominalSpeedMetresPerSecond: configuration.nominalSpeedMetresPerSecond,
    platform,
    shaft,
    movingEnvelope,
    entrances,
    levels: levelResult.levels,
    pallet: centeredLoadBox(configuration.pallet, platform?.minY ?? millimetres(0)),
    rollContainer: centeredLoadBox(configuration.rollContainer, platform?.minY ?? millimetres(0)),
    forkliftEnvelope: centeredLoadBox(configuration.forkliftEnvelope, platform?.minY ?? millimetres(0)),
    guideSystem: configuration.guideSystem?.orientation && positive(configuration.guideSystem.spacingMm)
      ? { orientation: configuration.guideSystem.orientation, spacingMm: configuration.guideSystem.spacingMm! }
      : undefined,
    throughCar: configuration.throughCar,
    frontAccess: configuration.frontAccess,
    rearAccess: configuration.rearAccess,
  }
  const withMechanics = { ...model, mechanical: normalizeCarrierMechanics(configuration.mechanical, model) }
  if (invalid.length) return { status: 'invalid', model: withMechanics, missingFields: [...new Set(missing)], invalidFields: [...new Set(invalid)] }
  const hasGeometry = Boolean(platform || shaft || entrances.length || levelResult.levels.length)
  if (!hasGeometry) return { status: 'empty', missingFields: [...new Set(missing)] }
  if (missing.length) return { status: 'partial', model: withMechanics, missingFields: [...new Set(missing)] }
  return { status: 'complete', model: withMechanics, missingFields: [] }
}
