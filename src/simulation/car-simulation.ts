import { metres } from '../engineering'
import type { CarLiftNormalizationResult } from '../elevator/car/car-lift-model'
import type { CarSpatialValidationResult } from '../collision/car-lift-spatial-validation'
import { calculateVerticalTravelDuration } from './vertical-travel'
import { getCarrierDriveVisualization } from './carrier-drive-visualization'
import { PLATFORM_VISUALIZATION_TIMING, type PlatformSimulationModelResult } from './platform-simulation'

/** Auto-specific travel guards. No goods geometry, vehicle dynamics or inferred approach motion. */
export function createCarSimulationModel(normalized: CarLiftNormalizationResult,
  validation: CarSpatialValidationResult): PlatformSimulationModelResult {
  if (normalized.status === 'empty') return { status: 'unavailable', issues: [{ code: 'planning-incomplete', path: 'platform.levels' }] }
  const m = normalized.model
  if (m.landingIssues?.length) return {status:m.landingIssues.some((i)=>i.status==='invalid') ? 'invalid' : 'unavailable',
    issues:[{code:'invalid-level',path:'levels'}]}
  const speed = calculateVerticalTravelDuration(metres(0), metres(0), m.nominalSpeedMetresPerSecond)
  if (speed.status !== 'available') return { status: speed.status === 'unknown' ? 'unavailable' : 'invalid',
    issues: [{ code: speed.status === 'unknown' ? 'planning-incomplete' : 'invalid-timing', path: speed.path }] }
  if (!m.platform || !m.shaft || !m.movingEnvelope || m.levels.length < 2) return {
    status: 'unavailable', issues: [{ code: 'planning-incomplete', path: 'platform.shaft.levels' }] }
  const conflicts = validation.issues.filter((i) => i.blocksPlatformTravel || i.severity === 'error' && [
    'platform-outside-shaft', 'moving-envelope-outside-shaft', 'invalid-level-order', 'invalid-pit-headroom',
  ].includes(i.code))
  const carried = m.vehicle?.bounds
  const topOffset = m.levels.at(-1)!.elevationMm - m.platform.minY
  const outside = carried && (carried.minX < m.shaft.minX || carried.maxX > m.shaft.maxX ||
    carried.minZ < m.shaft.minZ || carried.maxZ > m.shaft.maxZ || carried.minY < m.shaft.minY ||
    carried.maxY + topOffset > m.shaft.maxY)
  const guidePenetration = m.guideSystem && [m.platform, ...carried ? [carried] : []].some((footprint) => [-m.guideSystem!.spacingMm/2, m.guideSystem!.spacingMm/2].some((axis) =>
    m.guideSystem!.orientation === 'x' ? axis > footprint.minX && axis < footprint.maxX && footprint.minZ < 0 && footprint.maxZ > 0
      : axis > footprint.minZ && axis < footprint.maxZ && footprint.minX < 0 && footprint.maxX > 0))
  const mechanicalConflict = validation.results.find((r)=>r.ruleId === 'car.carrier.explicit-components' && r.status === 'invalid')
  if (conflicts.length || outside || guidePenetration || mechanicalConflict) return { status: 'invalid', issues: [{ code: 'geometric-conflict',
    path: conflicts[0]?.code ?? mechanicalConflict?.ruleId ?? (outside ? 'vehicle.shaft-sweep' : 'guide.moving-assembly') }] }
  const door = (side: 'front' | 'rear') => m.entrances.some((entrance)=>entrance.side === side &&
    entrance.clearWidthMm <= m.platform!.maxX-m.platform!.minX &&
    entrance.clearHeightMm <= m.platform!.maxY-m.platform!.minY)
  return { status: 'available', availability: 'partial', model: {
    family: 'car', levels: m.levels, referenceFloorMm: m.platform.minY,
    mechanicalVisualization:getCarrierDriveVisualization(m.drive),
    nominalSpeedMetresPerSecond: m.nominalSpeedMetresPerSecond, timing: PLATFORM_VISUALIZATION_TIMING,
    capabilities: {
      platformMovement: { available: true, path: 'platform.levels' },
      loadEnvelopeMovement: { available: !!carried, path: 'vehicle' },
      frontDoorMovement: { available: door('front'), path: 'entrances.front' },
      rearDoorMovement: { available: door('rear'), path: 'entrances.rear' },
      landingDoorMovement: { available: door('front') || door('rear'), path: 'entrances.levels' },
    }, unavailableBehaviors: ['driveSimulation', 'counterweightSimulation', 'ropeSimulation', 'safetyGearSimulation'],
  } }
}
