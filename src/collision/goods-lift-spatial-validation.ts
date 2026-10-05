import type { Millimetres } from '../engineering'
import type { GoodsBoxMm, GoodsLiftNormalizationResult, GoodsLiftNormalizedModel, GoodsPlanRectangleMm } from '../elevator/goods/goods-lift-model'

export type GoodsSpatialValidationStatus = 'ok' | 'warning' | 'invalid' | 'unknown'
export type GoodsSpatialIssueSeverity = 'info' | 'warning' | 'error'
export type GoodsSpatialIssueCode =
  | 'geometry-unavailable' | 'invalid-planning-geometry'
  | 'platform-outside-shaft' | 'zero-platform-clearance'
  | 'door-geometry-unavailable' | 'door-outside-platform'
  | 'pallet-unavailable' | 'pallet-outside-platform'
  | 'roll-container-unavailable' | 'roll-container-outside-platform'
  | 'forklift-envelope-unavailable' | 'forklift-envelope-outside-platform'
  | 'access-configuration-unavailable' | 'access-configuration-mismatch'
  | 'levels-unavailable' | 'invalid-level-order'
  | 'pit-headroom-unavailable' | 'invalid-pit-headroom'
  | 'moving-envelope-unavailable' | 'moving-envelope-outside-shaft'

export interface GoodsSpatialIssue {
  readonly code: GoodsSpatialIssueCode
  readonly severity: GoodsSpatialIssueSeverity
  readonly messageKey: `goods.spatial.${GoodsSpatialIssueCode}`
  readonly involvedComponentIds: readonly string[]
  readonly measurementsMm?: Readonly<Record<string, Millimetres>>
}

export interface GoodsSpatialRuleResult {
  readonly ruleId: string
  readonly status: GoodsSpatialValidationStatus
  readonly issues: readonly GoodsSpatialIssue[]
}

export interface GoodsSpatialValidationResult {
  readonly status: GoodsSpatialValidationStatus
  readonly results: readonly GoodsSpatialRuleResult[]
  readonly issues: readonly GoodsSpatialIssue[]
}

const issue = (code: GoodsSpatialIssueCode, severity: GoodsSpatialIssueSeverity,
  involvedComponentIds: readonly string[], measurementsMm?: Readonly<Record<string, Millimetres>>): GoodsSpatialIssue => ({
  code, severity, messageKey: `goods.spatial.${code}`, involvedComponentIds, measurementsMm,
})
const result = (ruleId: string, status: GoodsSpatialValidationStatus,
  issues: readonly GoodsSpatialIssue[] = []): GoodsSpatialRuleResult => ({ ruleId, status, issues })

function contains(container: GoodsPlanRectangleMm, subject: GoodsPlanRectangleMm) {
  return subject.minX >= container.minX && subject.maxX <= container.maxX &&
    subject.minZ >= container.minZ && subject.maxZ <= container.maxZ
}

function planMeasurements(container: GoodsPlanRectangleMm, subject: GoodsPlanRectangleMm) {
  return {
    left: (subject.minX - container.minX) as Millimetres,
    right: (container.maxX - subject.maxX) as Millimetres,
    front: (container.maxZ - subject.maxZ) as Millimetres,
    rear: (subject.minZ - container.minZ) as Millimetres,
  }
}

function loadRule(ruleId: string, unavailable: GoodsSpatialIssueCode, outside: GoodsSpatialIssueCode,
  id: string, load: GoodsPlanRectangleMm | undefined, model: GoodsLiftNormalizedModel) {
  if (!load) return result(ruleId, 'unknown', [issue(unavailable, 'info', [])])
  if (!model.platform) return result(ruleId, 'unknown', [issue('geometry-unavailable', 'info', [id])])
  const measurements = planMeasurements(model.platform, load)
  const heightFits = !('maxY' in load) || (load as GoodsBoxMm).maxY - (load as GoodsBoxMm).minY <=
    model.platform.maxY - model.platform.minY
  return contains(model.platform, load) && heightFits
    ? result(ruleId, 'ok')
    : result(ruleId, 'invalid', [issue(outside, 'error', [id, 'goods-platform'], measurements)])
}

function evaluateModel(model: GoodsLiftNormalizedModel): readonly GoodsSpatialRuleResult[] {
  const rules: GoodsSpatialRuleResult[] = []
  if (!model.platform || !model.shaft) {
    rules.push(result('goods.platform.shaft-fit', 'unknown', [issue('geometry-unavailable', 'info', [])]))
  } else {
    const measurements = planMeasurements(model.shaft, model.platform)
    if (!contains(model.shaft, model.platform)) {
      rules.push(result('goods.platform.shaft-fit', 'invalid', [issue('platform-outside-shaft', 'error', ['goods-platform', 'goods-shaft'], measurements)]))
    } else if (Object.values(measurements).some((value) => value === 0)) {
      rules.push(result('goods.platform.shaft-fit', 'warning', [issue('zero-platform-clearance', 'warning', ['goods-platform', 'goods-shaft'], measurements)]))
    } else rules.push(result('goods.platform.shaft-fit', 'ok'))
  }

  if (!model.platform || !model.entrances.length) {
    rules.push(result('goods.doors.platform-fit', 'unknown', [issue('door-geometry-unavailable', 'info', [])]))
  } else {
    const invalidDoor = model.entrances.find((entry) =>
      entry.widthMm > model.platform!.maxX - model.platform!.minX ||
      entry.heightMm > model.platform!.maxY - model.platform!.minY)
    rules.push(invalidDoor
      ? result('goods.doors.platform-fit', 'invalid', [issue('door-outside-platform', 'error', [invalidDoor.id, 'goods-platform'])])
      : result('goods.doors.platform-fit', 'ok'))
  }

  rules.push(loadRule('goods.load.pallet-fit', 'pallet-unavailable', 'pallet-outside-platform', 'goods-pallet', model.pallet, model))
  rules.push(loadRule('goods.load.roll-container-fit', 'roll-container-unavailable', 'roll-container-outside-platform', 'goods-roll-container', model.rollContainer, model))
  rules.push(loadRule('goods.load.forklift-envelope-fit', 'forklift-envelope-unavailable', 'forklift-envelope-outside-platform', 'goods-forklift-envelope', model.forkliftEnvelope, model))

  if (model.throughCar === undefined || model.frontAccess === undefined || model.rearAccess === undefined) {
    rules.push(result('goods.access.consistency', 'unknown', [issue('access-configuration-unavailable', 'info', [])]))
  } else {
    const matches = model.throughCar
      ? model.frontAccess && model.rearAccess
      : !(model.frontAccess && model.rearAccess)
    rules.push(matches ? result('goods.access.consistency', 'ok')
      : result('goods.access.consistency', 'invalid', [issue('access-configuration-mismatch', 'error', ['goods-front', 'goods-rear'])]))
  }

  if (!model.levels.length) {
    rules.push(result('goods.levels.order', 'unknown', [issue('levels-unavailable', 'info', [])]))
  } else {
    const invalid = model.levels.some((level, index) => index > 0 && level.elevationMm <= model.levels[index - 1].elevationMm)
    rules.push(invalid
      ? result('goods.levels.order', 'invalid', [issue('invalid-level-order', 'error', model.levels.map((level) => level.id))])
      : result('goods.levels.order', 'ok'))
  }

  if (!model.shaft) {
    rules.push(result('goods.vertical.pit-headroom', 'unknown', [issue('pit-headroom-unavailable', 'info', [])]))
  } else if (model.shaft.minY > (model.levels[0]?.elevationMm ?? model.shaft.minY) || model.shaft.maxY < model.shaft.minY) {
    rules.push(result('goods.vertical.pit-headroom', 'invalid', [issue('invalid-pit-headroom', 'error', ['goods-shaft'])]))
  } else rules.push(result('goods.vertical.pit-headroom', 'ok'))

  if (!model.shaft || !model.movingEnvelope) {
    rules.push(result('goods.movement.shaft-fit', 'unknown', [issue('moving-envelope-unavailable', 'info', [])]))
  } else {
    const fits = contains(model.shaft, model.movingEnvelope) &&
      model.movingEnvelope.minY >= model.shaft.minY && model.movingEnvelope.maxY <= model.shaft.maxY
    rules.push(fits ? result('goods.movement.shaft-fit', 'ok')
      : result('goods.movement.shaft-fit', 'invalid', [issue('moving-envelope-outside-shaft', 'error', ['goods-moving-envelope', 'goods-shaft'])]))
  }
  return rules
}

const priority: Readonly<Record<GoodsSpatialValidationStatus, number>> = { ok: 0, unknown: 1, warning: 2, invalid: 3 }

export function validateGoodsLiftSpatialGeometry(normalized: GoodsLiftNormalizationResult): GoodsSpatialValidationResult {
  if (normalized.status === 'empty') {
    const rules = [result('goods.geometry.available', 'unknown', [issue('geometry-unavailable', 'info', [])])]
    return { status: 'unknown', results: rules, issues: rules[0].issues }
  }
  const results = [...evaluateModel(normalized.model)]
  if (normalized.status === 'invalid') {
    results.unshift(result('goods.planning.structure', 'invalid', [issue('invalid-planning-geometry', 'error', [])]))
  }
  const status = results.reduce<GoodsSpatialValidationStatus>((current, entry) =>
    priority[entry.status] > priority[current] ? entry.status : current, 'ok')
  return { status, results, issues: results.flatMap((entry) => entry.issues) }
}
