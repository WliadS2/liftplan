import type { PassengerGeometryPlanningInput } from '../three/geometry/lift-geometry-planning-input'
import type { LandingIssueCode } from '../elevator/configuration/landing-planning'
import { createPassengerInstallationModel } from '../three/geometry/passenger/passenger-installation-model'
import { createPassengerMechanicalLayout } from '../three/geometry/passenger/mechanical/passenger-mechanical-layout'
import { createPassengerMechanicalComponents } from '../three/geometry/passenger/mechanical/mechanical-component-model'
import { createTractionDriveModel } from '../three/geometry/passenger/mechanical/traction-drive-model'
import { createPassengerSafetyModel } from '../three/geometry/passenger/mechanical/passenger-safety-model'
import { createPassengerDoorSystem } from '../three/geometry/passenger/doors/passenger-door-model'
import {
  createPassengerSpatialEnvelopes,
  type PassengerSpatialEnvelopes,
  type PassengerSpatialGeometryInputs,
  type PassengerSpatialMotionContext,
  type PassengerSpatialSubsystem,
  type SpatialEnvelope,
} from './passenger-spatial-envelopes'
import {
  aabbContains,
  aabbIntersects,
  measureGeometricClearances,
  measurePlanClearances,
  planRectangleContains,
  planRectanglesIntersect,
  type GeometricClearances,
} from './spatial-primitives'

export type SpatialValidationStatus = 'ok' | 'warning' | 'invalid' | 'unknown'
export type SpatialRuleSource = 'geometric' | 'planning' | 'verified-standard' | 'manufacturer'
export type SpatialIssueSeverity = 'info' | 'warning' | 'error'
export type PassengerSpatialIssueCode = LandingIssueCode
  | 'geometry-unavailable'
  | 'levels-unavailable' | 'invalid-level-order' | 'level-outside-installation'
  | 'cabin-geometry-unavailable' | 'invalid-cabin-dimensions' | 'shaft-geometry-unavailable'
  | 'cabin-outside-shaft' | 'cabin-travel-outside-shaft' | 'zero-geometric-clearance'
  | 'car-frame-unavailable' | 'car-frame-outside-shaft' | 'invalid-frame-cabin-relationship'
  | 'counterweight-layout-unavailable' | 'counterweight-outside-shaft' | 'counterweight-travel-outside-shaft'
  | 'counterweight-cabin-intersection'
  | 'rail-layout-unavailable' | 'collapsed-rail-pair' | 'rail-axis-outside-shaft' | 'guide-shoe-rail-mismatch'
  | 'door-data-unavailable' | 'landing-door-data-unavailable' | 'invalid-door-geometry'
  | 'missing-cabin-entrance' | 'door-width-exceeds-cabin-entrance'
  | 'door-height-exceeds-cabin-entrance' | 'door-panel-outside-entrance'
  | 'invalid-landing-level' | 'door-axis-mismatch'
  | 'buffer-data-unavailable' | 'buffer-outside-shaft'
  | 'upper-mechanical-unavailable' | 'mechanical-component-outside-shaft'
  | 'counterweight-sweep-unavailable' | 'counterweight-sweep-conflict'
  | 'fixed-obstacle-in-cabin-sweep'

export interface PassengerSpatialIssue {
  readonly code: PassengerSpatialIssueCode
  readonly severity: SpatialIssueSeverity
  readonly subsystem: PassengerSpatialSubsystem
  readonly messageKey: `spatial.${PassengerSpatialIssueCode}`
  readonly involvedComponentIds: readonly string[]
  readonly measurements?: GeometricClearances
  readonly affectedLevelId?: string
  readonly suggestedField?: string
  readonly blocksCabinTravel?: boolean
}

export interface PassengerSpatialRuleResult {
  readonly ruleId: string
  readonly status: SpatialValidationStatus
  readonly source: SpatialRuleSource
  readonly subsystem: PassengerSpatialSubsystem
  readonly issues: readonly PassengerSpatialIssue[]
  readonly clearances?: GeometricClearances
}

export interface PassengerSpatialValidationResult {
  readonly status: SpatialValidationStatus
  readonly results: readonly PassengerSpatialRuleResult[]
  readonly issues: readonly PassengerSpatialIssue[]
  readonly envelopes: PassengerSpatialEnvelopes
}

export interface PassengerSpatialRuleContext {
  readonly inputs: PassengerSpatialGeometryInputs
  readonly envelopes: PassengerSpatialEnvelopes
  readonly motion: PassengerSpatialMotionContext
}

export interface PassengerSpatialRule {
  readonly id: string
  readonly subsystem: PassengerSpatialSubsystem
  readonly source: SpatialRuleSource
  readonly requiredData: readonly string[]
  readonly evaluate: (context: PassengerSpatialRuleContext) => PassengerSpatialRuleResult
}

const issue = (
  code: PassengerSpatialIssueCode,
  severity: SpatialIssueSeverity,
  subsystem: PassengerSpatialSubsystem,
  involvedComponentIds: readonly string[],
  extra: Omit<PassengerSpatialIssue, 'code' | 'severity' | 'subsystem' | 'messageKey' | 'involvedComponentIds'> = {},
): PassengerSpatialIssue => ({
  code, severity, subsystem, messageKey: `spatial.${code}`, involvedComponentIds, ...extra,
})

const result = (
  rule: Pick<PassengerSpatialRule, 'id' | 'source' | 'subsystem'>,
  status: SpatialValidationStatus,
  issues: readonly PassengerSpatialIssue[] = [],
  clearances?: GeometricClearances,
): PassengerSpatialRuleResult => ({ ruleId: rule.id, source: rule.source, subsystem: rule.subsystem, status, issues, clearances })

const geometricRule = (
  id: string,
  subsystem: PassengerSpatialSubsystem,
  requiredData: readonly string[],
  evaluate: PassengerSpatialRule['evaluate'],
): PassengerSpatialRule => ({ id, subsystem, requiredData, source: 'geometric', evaluate })

const ruleLevels = geometricRule('passenger.levels.structure', 'levels', ['installation.levels'], (context) => {
  const rule = ruleLevels, levels = context.inputs.installation.levels
  const landingIssues = context.inputs.installation.landingIssues ?? []
  if (landingIssues.length) return result(rule,landingIssues.some((i)=>i.status==='invalid')?'invalid':'unknown',
    landingIssues.map((i)=>issue(i.code,i.status==='invalid'?'error':'info','levels',i.levelId?[i.levelId]:[],
      {affectedLevelId:i.levelId,blocksCabinTravel:i.status==='invalid',suggestedField:'levelElevationsMm'})))
  if (!levels.length) return result(rule, 'unknown', [issue('levels-unavailable', 'info', 'levels', [], { suggestedField: 'stopCount' })])
  for (const [index, level] of levels.entries()) {
    if (!Number.isFinite(level.elevationY) || (index > 0 && level.elevationY <= levels[index - 1].elevationY)) {
      return result(rule, 'invalid', [issue('invalid-level-order', 'error', 'levels', [level.id], {
        affectedLevelId: level.id, suggestedField: 'levelElevationsMm', blocksCabinTravel: true,
      })])
    }
  }
  const shaft = context.envelopes.shaftInterior?.bounds
  if (!shaft) return result(rule, 'unknown', [issue('shaft-geometry-unavailable', 'info', 'levels', [], { suggestedField: 'headroomMm' })])
  const outside = levels.find((level) => level.elevationY < shaft.min[1] || level.elevationY > shaft.max[1])
  return outside
    ? result(rule, 'invalid', [issue('level-outside-installation', 'error', 'levels', [outside.id, 'shaft'], {
      affectedLevelId: outside.id, suggestedField: 'levelElevationsMm', blocksCabinTravel: true,
    })])
    : result(rule, 'ok')
})

const ruleCabinDimensions = geometricRule('passenger.cabin.dimensions', 'cabin', [
  'planning.cabin.widthMm', 'planning.cabin.depthMm', 'planning.cabin.heightMm',
], (context) => {
  const rule = ruleCabinDimensions
  const values = [context.inputs.planning.cabin.widthMm, context.inputs.planning.cabin.depthMm, context.inputs.planning.cabin.heightMm]
  if (values.some((value) => value === undefined)) return result(rule, 'unknown', [issue('cabin-geometry-unavailable', 'info', 'cabin', [], { suggestedField: 'cabinWidthMm' })])
  return values.every((value) => Number.isFinite(value) && value! > 0)
    ? result(rule, 'ok')
    : result(rule, 'invalid', [issue('invalid-cabin-dimensions', 'error', 'cabin', ['cabin'], {
      suggestedField: 'cabinWidthMm', blocksCabinTravel: true,
    })])
})

const ruleCabinShaft = geometricRule('passenger.cabin.shaft-fit', 'cabin', ['cabin', 'shaft'], (context) => {
  const rule = ruleCabinShaft
  const cabin = context.envelopes.cabin, shaft = context.envelopes.shaftInterior
  if (!cabin) return result(rule, 'unknown', [issue('cabin-geometry-unavailable', 'info', 'cabin', [], { suggestedField: 'cabinWidthMm' })])
  if (!shaft) return result(rule, 'unknown', [issue('shaft-geometry-unavailable', 'info', 'shaft', ['cabin'], { suggestedField: 'shaftWidthMm' })])
  const clearances = measurePlanClearances(shaft.plan, cabin.plan)
  if (!planRectangleContains(shaft.plan, cabin.plan)) {
    return result(rule, 'invalid', [issue('cabin-outside-shaft', 'error', 'cabin', ['cabin', 'shaft'], {
      measurements: clearances, suggestedField: 'shaftWidthMm', blocksCabinTravel: true,
    })], clearances)
  }
  if (shaft.bounds && context.envelopes.cabinSweep?.bounds && !aabbContains(shaft.bounds, context.envelopes.cabinSweep.bounds)) {
    const sweptClearances = measureGeometricClearances(shaft.bounds, context.envelopes.cabinSweep.bounds)
    return result(rule, 'invalid', [issue('cabin-travel-outside-shaft', 'error', 'movement', ['cabin', 'shaft'], {
      measurements: sweptClearances, suggestedField: 'headroomMm', blocksCabinTravel: true,
    })], sweptClearances)
  }
  return Object.values(clearances).some((value) => value === 0)
    ? result(rule, 'warning', [issue('zero-geometric-clearance', 'warning', 'cabin', ['cabin', 'shaft'], {
      measurements: clearances,
    })], clearances)
    : result(rule, 'ok', [], clearances)
})

const ruleFrame = geometricRule('passenger.car-frame.shaft-fit', 'car-frame', ['layout.carFrame', 'shaft'], (context) => {
  const rule = ruleFrame
  if (context.inputs.layout.validation.issues.some((entry) => entry.code === 'frame-intersects-cabin')) {
    return result(rule, 'invalid', [issue('invalid-frame-cabin-relationship', 'error', 'car-frame', ['car-frame', 'cabin'], { blocksCabinTravel: true })])
  }
  const frame = context.envelopes.carFrame, shaft = context.envelopes.shaftInterior
  if (!frame) return result(rule, 'unknown', [issue('car-frame-unavailable', 'info', 'car-frame', [], { suggestedField: 'mechanical.carRailSpacingMm' })])
  if (!shaft) return result(rule, 'unknown', [issue('shaft-geometry-unavailable', 'info', 'shaft', ['car-frame'], { suggestedField: 'shaftWidthMm' })])
  const evaluatedFrame = context.envelopes.carFrameSweep ?? frame
  return planRectangleContains(shaft.plan, evaluatedFrame.plan) && (!shaft.bounds || !evaluatedFrame.bounds || aabbContains(shaft.bounds, evaluatedFrame.bounds))
    ? result(rule, 'ok')
    : result(rule, 'invalid', [issue('car-frame-outside-shaft', 'error', 'car-frame', ['car-frame', 'shaft'], {
      suggestedField: 'mechanical.carRailSpacingMm', blocksCabinTravel: true,
    })])
})

const ruleCounterweight = geometricRule('passenger.counterweight.static-fit', 'counterweight', ['layout.counterweight', 'shaft'], (context) => {
  const rule = ruleCounterweight, layoutIssues = context.inputs.layout.validation.issues
  if (layoutIssues.some((entry) => entry.code === 'counterweight-intersects-cabin')) {
    return result(rule, 'invalid', [issue('counterweight-cabin-intersection', 'error', 'counterweight', ['counterweight', 'cabin'], { blocksCabinTravel: true })])
  }
  if (layoutIssues.some((entry) => entry.code === 'outside-shaft' && entry.path?.join('.').includes('counterweight'))) {
    return result(rule, 'invalid', [issue('counterweight-outside-shaft', 'error', 'counterweight', ['counterweight', 'shaft'], {
      suggestedField: 'mechanical.counterweightOffsetMm', blocksCabinTravel: true,
    })])
  }
  const weight = context.envelopes.counterweight, shaft = context.envelopes.shaftInterior
  if (!weight) return result(rule, 'unknown', [issue('counterweight-layout-unavailable', 'info', 'counterweight', [], { suggestedField: 'counterweightWidthMm' })])
  if (!shaft) return result(rule, 'unknown', [issue('shaft-geometry-unavailable', 'info', 'shaft', ['counterweight'], { suggestedField: 'shaftWidthMm' })])
  if (!planRectangleContains(shaft.plan, weight.plan) || (shaft.bounds && weight.bounds && !aabbContains(shaft.bounds, weight.bounds))) {
    return result(rule, 'invalid', [issue('counterweight-outside-shaft', 'error', 'counterweight', ['counterweight', 'shaft'], {
      suggestedField: 'mechanical.counterweightOffsetMm', blocksCabinTravel: true,
    })])
  }
  const sweptWeight = context.envelopes.counterweightSweep?.bounds
  if (shaft.bounds && sweptWeight && !aabbContains(shaft.bounds, sweptWeight)) {
    return result(rule, 'invalid', [issue('counterweight-travel-outside-shaft', 'error', 'counterweight', ['counterweight', 'shaft'], {
      measurements: measureGeometricClearances(shaft.bounds, sweptWeight),
      suggestedField: 'mechanical.counterweightOffsetMm',
      blocksCabinTravel: true,
    })])
  }
  return context.envelopes.cabin?.bounds && weight.bounds && aabbIntersects(context.envelopes.cabin.bounds, weight.bounds)
    ? result(rule, 'invalid', [issue('counterweight-cabin-intersection', 'error', 'counterweight', ['counterweight', 'cabin'], { blocksCabinTravel: true })])
    : result(rule, 'ok')
})

const ruleRails = geometricRule('passenger.rails.structure', 'car-rails', ['layout.carRails', 'layout.counterweightRails'], (context) => {
  const rule = ruleRails
  if (context.inputs.layout.validation.issues.some((entry) => entry.code === 'collapsed-rail-pair')) {
    return result(rule, 'invalid', [issue('collapsed-rail-pair', 'error', 'car-rails', ['rail-pair'], { blocksCabinTravel: true })])
  }
  const pairs = [context.envelopes.carRails, context.envelopes.counterweightRails]
  if (pairs.some((entry) => !entry)) return result(rule, 'unknown', [issue('rail-layout-unavailable', 'info', 'car-rails', [], { suggestedField: 'mechanical.carRailSpacingMm' })])
  const shaft = context.envelopes.shaftInterior
  if (!shaft) return result(rule, 'unknown', [issue('shaft-geometry-unavailable', 'info', 'shaft', pairs.flatMap((entry) => entry?.componentIds ?? []), { suggestedField: 'shaftWidthMm' })])
  return pairs.every((entry) => planRectangleContains(shaft.plan, entry!.plan))
    ? result(rule, 'ok')
    : result(rule, 'invalid', [issue('rail-axis-outside-shaft', 'error', 'car-rails', pairs.flatMap((entry) => entry?.componentIds ?? []), {
      suggestedField: 'mechanical.carRailSpacingMm', blocksCabinTravel: true,
    })])
})

const ruleGuideShoes = geometricRule('passenger.guide-shoes.rail-reference', 'car-rails', ['components.guideShoes'], (context) => {
  const rule = ruleGuideShoes, components = context.inputs.components
  const shoes = [...components.carGuideShoes, ...components.counterweightGuideShoes]
  if (!shoes.length) return result(rule, 'unknown', [issue('rail-layout-unavailable', 'info', 'car-rails', [], { suggestedField: 'mechanical.components' })])
  const railIds = new Set([...(components.carRails ?? []), ...(components.counterweightRails ?? [])].map((rail) => rail.id))
  const missing = shoes.find((shoe) => !railIds.has(shoe.railId))
  return missing
    ? result(rule, 'invalid', [issue('guide-shoe-rail-mismatch', 'error', 'car-rails', [missing.id, missing.railId], { blocksCabinTravel: true })])
    : result(rule, 'ok')
})

const ruleDoors = geometricRule('passenger.doors.structure', 'doors', ['doors'], (context) => {
  const rule = ruleDoors, doors = context.inputs.doors, levels = context.inputs.installation.levels
  const mappedIssues = doors.validation.issues.map((entry): PassengerSpatialIssue => {
    const componentId = entry.path?.[1]
    const involvedComponentIds = typeof componentId === 'string' ? [componentId] : []
    switch (entry.code) {
      case 'missing-door-reference':
        return issue('missing-cabin-entrance', 'error', 'doors', involvedComponentIds, { suggestedField: 'doors.landings' })
      case 'door-width-exceeds-cabin-entrance':
        return issue('door-width-exceeds-cabin-entrance', 'error', 'doors', involvedComponentIds, { suggestedField: 'doorWidthMm' })
      case 'door-height-exceeds-cabin-entrance':
        return issue('door-height-exceeds-cabin-entrance', 'error', 'doors', involvedComponentIds, { suggestedField: 'doorHeightMm' })
      case 'door-panel-outside-entrance':
        return issue('door-panel-outside-entrance', 'error', 'doors', involvedComponentIds, { suggestedField: 'doors.cabin' })
      case 'invalid-door-level':
        return issue('invalid-landing-level', 'error', 'doors', involvedComponentIds, { suggestedField: 'doors.landings' })
      case 'entrance-axis-mismatch':
        return issue('door-axis-mismatch', 'error', 'doors', involvedComponentIds, { suggestedField: 'doors.landings' })
      default:
        return issue('invalid-door-geometry', 'error', 'doors', involvedComponentIds, { suggestedField: 'doors.cabin' })
    }
  })
  if (mappedIssues.length) {
    const uniqueIssues = mappedIssues.filter((entry, index, all) => all.findIndex((candidate) =>
      candidate.code === entry.code && candidate.involvedComponentIds[0] === entry.involvedComponentIds[0]) === index)
    return result(rule, 'invalid', uniqueIssues)
  }
  if (!doors.cabin.length) return result(rule, 'unknown', [issue('door-data-unavailable', 'info', 'doors', [], { suggestedField: 'doors.cabin' })])
  if (!doors.landings.length) return result(rule, 'unknown', [issue('landing-door-data-unavailable', 'info', 'doors', doors.cabin.map((entry) => entry.id), { suggestedField: 'doors.landings' })])
  for (const entry of [...doors.cabin, ...doors.landings]) {
    const assigned = entry.role === 'landing' ? levels.find((level) => level.id === entry.levelId) : undefined
    if (entry.role === 'landing' && (!assigned || assigned.elevationY !== entry.origin[1])) {
      return result(rule, 'invalid', [issue('invalid-landing-level', 'error', 'doors', [entry.id], {
        affectedLevelId: entry.levelId, suggestedField: 'doors.landings',
      })])
    }
    const shaft = context.inputs.installation.shaft
    if (entry.role === 'landing' && shaft && (entry.origin[0]-entry.openingWidth/2 < -shaft.width/2 ||
      entry.origin[0]+entry.openingWidth/2 > shaft.width/2 || (shaft.verticalExtent &&
        (entry.origin[1] < shaft.verticalExtent.bottomY || entry.origin[1]+entry.openingHeight > shaft.verticalExtent.topY)))) {
      return result(rule,'invalid',[issue('landing-door-shaft-conflict','error','doors',[entry.id,'shaft'],
        {affectedLevelId:entry.levelId,blocksCabinTravel:true})])
    }
    const panelsValid = entry.openingWidth > 0 && entry.openingHeight > 0 && entry.panels.every((panel) =>
      panel.width > 0 && panel.height > 0 && panel.thickness > 0 &&
      [...panel.closed.center, ...panel.open.center].every(Number.isFinite))
    const collapsed = entry.panels.length > 1 && entry.panels.some((panel, index) =>
      entry.panels.some((other, otherIndex) => index !== otherIndex &&
        panel.closed.center.every((value, axis) => value === other.closed.center[axis]) && panel.width === other.width && panel.height === other.height))
    if (!panelsValid || collapsed) return result(rule, 'invalid', [issue('invalid-door-geometry', 'error', 'doors', [entry.id, ...entry.panels.map((panel) => panel.id)], { suggestedField: 'doors.cabin' })])
  }
  return doors.relationships.every((entry) => entry.entranceAxesCorrespond)
    ? result(rule, 'ok')
    : result(rule, 'invalid', [issue('door-axis-mismatch', 'error', 'doors', [], { suggestedField: 'doors.landings' })])
})

const ruleBuffers = geometricRule('passenger.buffers.shaft-fit', 'buffers', ['components.buffers', 'shaft'], (context) => {
  const rule = ruleBuffers, buffers = context.envelopes.buffers, shaft = context.envelopes.shaftInterior
  if (!buffers.length) return result(rule, 'unknown', [issue('buffer-data-unavailable', 'info', 'buffers', [], { suggestedField: 'mechanical.components' })])
  if (!shaft?.bounds) return result(rule, 'unknown', [issue('shaft-geometry-unavailable', 'info', 'shaft', buffers.flatMap((entry) => entry.componentIds), { suggestedField: 'pitDepthMm' })])
  const outside = buffers.find((entry) => entry.bounds && !aabbContains(shaft.bounds!, entry.bounds))
  return outside
    ? result(rule, 'invalid', [issue('buffer-outside-shaft', 'error', 'buffers', outside.componentIds, { suggestedField: 'mechanical.carBufferPositionsMm' })])
    : result(rule, 'ok')
})

const ruleUpperMechanical = geometricRule('passenger.upper-mechanical.shaft-fit', 'traction', ['drive.machine', 'shaft'], (context) => {
  const rule = ruleUpperMechanical, systems = context.envelopes.upperMechanical, shaft = context.envelopes.shaftInterior
  if (!systems.length) return result(rule, 'unknown', [issue('upper-mechanical-unavailable', 'info', 'traction', [], { suggestedField: 'mechanical.drive' })])
  if (!shaft?.bounds) return result(rule, 'unknown', [issue('shaft-geometry-unavailable', 'info', 'shaft', systems.flatMap((entry) => entry.componentIds), { suggestedField: 'headroomMm' })])
  const outside = systems.find((entry) => entry.bounds && !aabbContains(shaft.bounds!, entry.bounds))
  return outside
    ? result(rule, 'invalid', [issue('mechanical-component-outside-shaft', 'error', outside.subsystem, outside.componentIds, { suggestedField: 'mechanical.drive' })])
    : result(rule, 'ok')
})

const ruleSweeps = geometricRule('passenger.movement.swept-spaces', 'movement', ['cabinSweep'], (context) => {
  const rule = ruleSweeps, cabin = context.envelopes.cabinSweep
  if (!cabin?.bounds) return result(rule, 'unknown', [issue('cabin-geometry-unavailable', 'info', 'movement', ['cabin'], { suggestedField: 'floorHeightMm' })])
  let conflict: { moving: SpatialEnvelope; obstacle: SpatialEnvelope } | undefined
  for (const moving of [cabin, context.envelopes.carFrameSweep]) {
    if (!moving?.bounds) continue
    const movingBounds = moving.bounds
    const obstacle = context.envelopes.fixedObstacles.find((entry) =>
      entry.bounds && aabbIntersects(movingBounds, entry.bounds))
    if (obstacle) {
      conflict = { moving, obstacle }
      break
    }
  }
  if (conflict) return result(rule, 'invalid', [issue('fixed-obstacle-in-cabin-sweep', 'error', 'movement', [
    ...conflict.moving.componentIds,
    ...conflict.obstacle.componentIds,
  ], { blocksCabinTravel: true })])
  const counterweight = context.envelopes.counterweightSweep
  if (!counterweight?.bounds) return result(rule, 'unknown', [issue('counterweight-sweep-unavailable', 'info', 'movement', ['counterweight'])])
  return planRectanglesIntersect(cabin.plan, counterweight.plan) && aabbIntersects(cabin.bounds, counterweight.bounds)
    ? result(rule, 'invalid', [issue('counterweight-sweep-conflict', 'error', 'movement', ['cabin', 'counterweight'], {
      blocksCabinTravel: true,
    })])
    : result(rule, 'ok')
})

export const PASSENGER_SPATIAL_RULES: readonly PassengerSpatialRule[] = [
  ruleLevels,
  ruleCabinDimensions,
  ruleCabinShaft,
  ruleFrame,
  ruleCounterweight,
  ruleRails,
  ruleGuideShoes,
  ruleDoors,
  ruleBuffers,
  ruleUpperMechanical,
  ruleSweeps,
]

const statusPriority: Record<SpatialValidationStatus, number> = { ok: 0, unknown: 1, warning: 2, invalid: 3 }

export function validatePassengerSpatialGeometry(
  inputs: PassengerSpatialGeometryInputs,
  motion: PassengerSpatialMotionContext = {},
  rules: readonly PassengerSpatialRule[] = PASSENGER_SPATIAL_RULES,
): PassengerSpatialValidationResult {
  const envelopes = createPassengerSpatialEnvelopes(inputs, motion)
  const context = { inputs, envelopes, motion }
  const results = rules.map((rule) => rule.evaluate(context))
  const status = results.reduce<SpatialValidationStatus>((current, entry) =>
    statusPriority[entry.status] > statusPriority[current] ? entry.status : current, 'ok')
  return { status, results, issues: results.flatMap((entry) => entry.issues), envelopes }
}

export function createPassengerSpatialValidationFromPlanningInput(
  planning: PassengerGeometryPlanningInput,
  motion: PassengerSpatialMotionContext = {},
): PassengerSpatialValidationResult | undefined {
  const installationResult = createPassengerInstallationModel(planning)
  if (!('model' in installationResult) || !installationResult.model) return undefined
  const installation = installationResult.model
  const layout = createPassengerMechanicalLayout(planning, installation)
  const components = createPassengerMechanicalComponents(planning.mechanical.components, layout)
  const drive = createTractionDriveModel(planning.mechanical.drive, installation, layout, components)
  const safety = createPassengerSafetyModel(planning.mechanical.safety, installation, layout, components, drive.machine)
  const doors = createPassengerDoorSystem(planning.doors, installation)
  return validatePassengerSpatialGeometry({ planning, installation, layout, components, drive, safety, doors }, motion)
}
