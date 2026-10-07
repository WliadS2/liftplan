import type { Millimetres } from '../engineering'
import { validateCarrierMechanics } from './carrier-mechanical-validation'
import type {
  CarLiftNormalizationResult,
  CarLiftNormalizedModel,
  CarPlanRectangleMm,
} from '../elevator/car/car-lift-model'

export type CarSpatialValidationStatus = 'ok' | 'warning' | 'invalid' | 'unknown'
export type CarSpatialIssueSeverity = 'info' | 'warning' | 'error'
export type CarSpatialIssueCode =
  | 'geometry-unavailable' | 'invalid-planning-geometry'
  | 'platform-outside-shaft' | 'zero-platform-clearance'
  | 'vehicle-unavailable' | 'vehicle-outside-platform' | 'vehicle-too-tall'
  | 'vehicle-position-unavailable' | 'vehicle-position-outside-platform'
  | 'door-geometry-unavailable' | 'vehicle-door-passage-conflict'
  | 'door-passage-envelope-unavailable' | 'door-passage-envelope-conflict'
  | 'access-configuration-unavailable' | 'access-configuration-mismatch'
  | 'levels-unavailable' | 'invalid-level-order'
  | 'pit-headroom-unavailable' | 'invalid-pit-headroom'
  | 'moving-envelope-unavailable' | 'moving-envelope-outside-shaft'
  | 'vehicle-sweep-unavailable' | 'vehicle-sweep-outside-platform'

export interface CarSpatialIssue {
  readonly code: CarSpatialIssueCode
  readonly severity: CarSpatialIssueSeverity
  readonly messageKey: `car.spatial.${CarSpatialIssueCode}`
  readonly involvedComponentIds: readonly string[]
  readonly measurementsMm?: Readonly<Record<string, Millimetres>>
}

export interface CarSpatialRuleResult {
  readonly ruleId: string
  readonly status: CarSpatialValidationStatus
  readonly issues: readonly CarSpatialIssue[]
}

export interface CarSpatialValidationResult {
  readonly status: CarSpatialValidationStatus
  readonly results: readonly CarSpatialRuleResult[]
  readonly issues: readonly CarSpatialIssue[]
}

const issue = (code: CarSpatialIssueCode, severity: CarSpatialIssueSeverity,
  involvedComponentIds: readonly string[], measurementsMm?: Readonly<Record<string, Millimetres>>): CarSpatialIssue => ({
  code, severity, messageKey: `car.spatial.${code}`, involvedComponentIds, measurementsMm,
})
const result = (ruleId: string, status: CarSpatialValidationStatus,
  issues: readonly CarSpatialIssue[] = []): CarSpatialRuleResult => ({ ruleId, status, issues })

function contains(container: CarPlanRectangleMm, subject: CarPlanRectangleMm) {
  return subject.minX >= container.minX && subject.maxX <= container.maxX &&
    subject.minZ >= container.minZ && subject.maxZ <= container.maxZ
}

function planMeasurements(container: CarPlanRectangleMm, subject: CarPlanRectangleMm) {
  return {
    left: (subject.minX - container.minX) as Millimetres,
    right: (container.maxX - subject.maxX) as Millimetres,
    front: (container.maxZ - subject.maxZ) as Millimetres,
    rear: (subject.minZ - container.minZ) as Millimetres,
  }
}

function evaluateModel(model: CarLiftNormalizedModel): readonly CarSpatialRuleResult[] {
  const rules: CarSpatialRuleResult[] = []
  const mechanical = validateCarrierMechanics(model.mechanical,model.shaft,model.platform,model.levels)
  if (mechanical.length) rules.push(result('car.carrier.explicit-components',
    mechanical.some((c)=>c.code !== 'component-reference-missing') ? 'invalid' : 'unknown',
    mechanical.map((c)=>issue('invalid-planning-geometry',c.code === 'component-reference-missing' ? 'info' : 'error',
      c.involvedComponentIds.map((id)=>`car-${id}`)))))
  if (!model.platform || !model.shaft) {
    rules.push(result('car.platform.shaft-fit', 'unknown', [issue('geometry-unavailable', 'info', [])]))
  } else {
    const measurements = planMeasurements(model.shaft, model.platform)
    if (!contains(model.shaft, model.platform)) {
      rules.push(result('car.platform.shaft-fit', 'invalid', [issue('platform-outside-shaft', 'error', ['car-platform', 'car-shaft'], measurements)]))
    } else if (Object.values(measurements).some((value) => value === 0)) {
      rules.push(result('car.platform.shaft-fit', 'warning', [issue('zero-platform-clearance', 'warning', ['car-platform', 'car-shaft'], measurements)]))
    } else rules.push(result('car.platform.shaft-fit', 'ok'))
  }

  if (!model.vehicle || !model.platform || !model.vehicleLoadingDirection) {
    rules.push(result('car.vehicle.platform-fit', 'unknown', [issue('vehicle-unavailable', 'info', [])]))
  } else {
    const requiredX = model.vehicleLoadingDirection === 'shaft-z' ? model.vehicle.widthMm : model.vehicle.lengthMm
    const requiredZ = model.vehicleLoadingDirection === 'shaft-z' ? model.vehicle.lengthMm : model.vehicle.widthMm
    const availableX = model.platform.maxX - model.platform.minX
    const availableZ = model.platform.maxZ - model.platform.minZ
    rules.push(requiredX <= availableX && requiredZ <= availableZ
      ? result('car.vehicle.platform-fit', 'ok')
      : result('car.vehicle.platform-fit', 'invalid', [issue('vehicle-outside-platform', 'error', ['car-vehicle', 'car-platform'], {
          lateral: (availableX - requiredX) as Millimetres,
          longitudinal: (availableZ - requiredZ) as Millimetres,
        })]))
  }

  if (!model.vehicle?.heightMm || !model.platform) {
    rules.push(result('car.vehicle.height-fit', 'unknown', [issue('vehicle-unavailable', 'info', [])]))
  } else {
    const available = (model.platform.maxY - model.platform.minY) as Millimetres
    rules.push(model.vehicle.heightMm <= available
      ? result('car.vehicle.height-fit', 'ok')
      : result('car.vehicle.height-fit', 'invalid', [issue('vehicle-too-tall', 'error', ['car-vehicle', 'car-platform'], {
          available, difference: (available - model.vehicle.heightMm) as Millimetres,
        })]))
  }

  if (!model.vehicle?.bounds || !model.platform) {
    rules.push(result('car.vehicle.position-fit', 'unknown', [issue('vehicle-position-unavailable', 'info', [])]))
  } else {
    const measurements = planMeasurements(model.platform, model.vehicle.bounds)
    rules.push(contains(model.platform, model.vehicle.bounds)
      ? result('car.vehicle.position-fit', 'ok')
      : result('car.vehicle.position-fit', 'invalid', [issue('vehicle-position-outside-platform', 'error', ['car-vehicle', 'car-platform'], measurements)]))
  }

  if (!model.vehicle || !model.entrances.length || !model.vehicleLoadingDirection) {
    rules.push(result('car.vehicle.door-passage', 'unknown', [issue('door-geometry-unavailable', 'info', [])]))
  } else {
    const projectedWidth = model.vehicleLoadingDirection === 'shaft-z' ? model.vehicle.widthMm : model.vehicle.lengthMm
    const invalidDoor = model.entrances.find((entry) => projectedWidth > entry.clearWidthMm ||
      (model.vehicle!.heightMm !== undefined && model.vehicle!.heightMm! > entry.clearHeightMm))
    rules.push(invalidDoor
      ? result('car.vehicle.door-passage', 'invalid', [issue('vehicle-door-passage-conflict', 'error', ['car-vehicle', invalidDoor.id], {
          widthDifference: (invalidDoor.clearWidthMm - projectedWidth) as Millimetres,
          heightDifference: ((invalidDoor.clearHeightMm - (model.vehicle.heightMm ?? invalidDoor.clearHeightMm))) as Millimetres,
        })])
      : result('car.vehicle.door-passage', 'ok'))
  }

  const passage = model.doorPassageEnvelope
  if (!passage || passage.clearWidthMm === undefined || passage.clearHeightMm === undefined || !model.entrances.length) {
    rules.push(result('car.approach.door-passage-envelope', 'unknown', [issue('door-passage-envelope-unavailable', 'info', [])]))
  } else {
    const invalidDoor = model.entrances.find((entry) => passage.clearWidthMm! > entry.clearWidthMm ||
      passage.clearHeightMm! > entry.clearHeightMm)
    rules.push(invalidDoor
      ? result('car.approach.door-passage-envelope', 'invalid', [issue('door-passage-envelope-conflict', 'error', ['car-door-passage-envelope', invalidDoor.id])])
      : result('car.approach.door-passage-envelope', 'ok'))
  }

  if (model.throughCar === undefined || model.frontAccess === undefined || model.rearAccess === undefined) {
    rules.push(result('car.access.consistency', 'unknown', [issue('access-configuration-unavailable', 'info', [])]))
  } else {
    const matches = model.throughCar
      ? model.frontAccess && model.rearAccess
      : !(model.frontAccess && model.rearAccess)
    rules.push(matches ? result('car.access.consistency', 'ok')
      : result('car.access.consistency', 'invalid', [issue('access-configuration-mismatch', 'error', ['car-front', 'car-rear'])]))
  }

  if (!model.levels.length) {
    rules.push(result('car.levels.order', 'unknown', [issue('levels-unavailable', 'info', [])]))
  } else {
    const invalid = model.levels.some((level, index) => index > 0 && level.elevationMm <= model.levels[index - 1].elevationMm)
    rules.push(invalid
      ? result('car.levels.order', 'invalid', [issue('invalid-level-order', 'error', model.levels.map((level) => level.id))])
      : result('car.levels.order', 'ok'))
  }

  if (!model.shaft) {
    rules.push(result('car.vertical.pit-headroom', 'unknown', [issue('pit-headroom-unavailable', 'info', [])]))
  } else if (model.shaft.minY > (model.levels[0]?.elevationMm ?? model.shaft.minY) || model.shaft.maxY < model.shaft.minY) {
    rules.push(result('car.vertical.pit-headroom', 'invalid', [issue('invalid-pit-headroom', 'error', ['car-shaft'])]))
  } else rules.push(result('car.vertical.pit-headroom', 'ok'))

  if (!model.shaft || !model.movingEnvelope) {
    rules.push(result('car.movement.shaft-fit', 'unknown', [issue('moving-envelope-unavailable', 'info', [])]))
  } else {
    const fits = contains(model.shaft, model.movingEnvelope) &&
      model.movingEnvelope.minY >= model.shaft.minY && model.movingEnvelope.maxY <= model.shaft.maxY
    rules.push(fits ? result('car.movement.shaft-fit', 'ok')
      : result('car.movement.shaft-fit', 'invalid', [issue('moving-envelope-outside-shaft', 'error', ['car-moving-envelope', 'car-shaft'])]))
  }

  if (!model.vehicleSweptEnvelope || !model.platform) {
    rules.push(result('car.vehicle.swept-envelope-fit', 'unknown', [issue('vehicle-sweep-unavailable', 'info', [])]))
  } else {
    const measurements = planMeasurements(model.platform, model.vehicleSweptEnvelope.bounds)
    rules.push(contains(model.platform, model.vehicleSweptEnvelope.bounds)
      ? result('car.vehicle.swept-envelope-fit', 'ok')
      : result('car.vehicle.swept-envelope-fit', 'invalid', [issue('vehicle-sweep-outside-platform', 'error', ['car-vehicle-sweep', 'car-platform'], measurements)]))
  }
  return rules
}

const priority: Readonly<Record<CarSpatialValidationStatus, number>> = { ok: 0, unknown: 1, warning: 2, invalid: 3 }

export function validateCarLiftSpatialGeometry(normalized: CarLiftNormalizationResult): CarSpatialValidationResult {
  if (normalized.status === 'empty') {
    const results = [result('car.geometry.available', 'unknown', [issue('geometry-unavailable', 'info', [])])]
    return { status: 'unknown', results, issues: results[0].issues }
  }
  const results = [...evaluateModel(normalized.model)]
  if (normalized.status === 'invalid') {
    results.unshift(result('car.planning.structure', 'invalid', [issue('invalid-planning-geometry', 'error', [])]))
  }
  const status = results.reduce<CarSpatialValidationStatus>((current, entry) =>
    priority[entry.status] > priority[current] ? entry.status : current, 'ok')
  return { status, results, issues: results.flatMap((entry) => entry.issues) }
}
