import { metres, millimetres, millimetresToMetres, metresToMillimetres, type Metres, type Millimetres } from '../../../engineering'
import type { VerticalAnchor } from '../../../elevator/configuration/vertical-placement-data'

export interface VerticalRegion { readonly bottomY: Metres; readonly topY: Metres }
export interface PassengerVerticalModel {
  readonly landingElevations: readonly Metres[]
  readonly lowestLandingY?: Metres; readonly highestLandingY?: Metres
  readonly pitBottomY?: Metres; readonly shaftTopY?: Metres
  readonly travelRegion?: VerticalRegion; readonly headroomRegion?: VerticalRegion
  readonly topMechanicalY?: Metres; readonly topMechanicalZone?: VerticalRegion
  readonly cabinLevelIndex?: number; readonly cabinElevationY?: Metres
}

/** Semantic references only; missing pit/headroom/zone inputs never acquire component clearances. */
export function createPassengerVerticalModel(elevations: readonly Metres[], pitDepthMm?: Millimetres,
  headroomMm?: Millimetres, cabinLevelIndex?: number, topInsetMm?: Millimetres): PassengerVerticalModel {
  const lowestLandingY = elevations[0], highestLandingY = elevations.at(-1)
  const pitBottomY = lowestLandingY !== undefined && pitDepthMm !== undefined && Number.isFinite(pitDepthMm) && pitDepthMm >= 0
    ? metres(lowestLandingY - millimetresToMetres(pitDepthMm)) : undefined
  const shaftTopY = highestLandingY !== undefined && headroomMm !== undefined && Number.isFinite(headroomMm) && headroomMm >= 0
    ? metres(highestLandingY + millimetresToMetres(headroomMm)) : undefined
  const topMechanicalY = highestLandingY !== undefined && shaftTopY !== undefined && topInsetMm !== undefined &&
    Number.isFinite(topInsetMm) && topInsetMm >= 0 && headroomMm !== undefined && topInsetMm <= headroomMm
    ? metres(shaftTopY - millimetresToMetres(topInsetMm)) : undefined
  const index = cabinLevelIndex ?? (elevations.length ? 0 : undefined)
  return { landingElevations: elevations, lowestLandingY, highestLandingY, pitBottomY, shaftTopY, topMechanicalY,
    travelRegion: lowestLandingY !== undefined && highestLandingY !== undefined ? { bottomY: lowestLandingY, topY: highestLandingY } : undefined,
    headroomRegion: highestLandingY !== undefined && shaftTopY !== undefined ? { bottomY: highestLandingY, topY: shaftTopY } : undefined,
    topMechanicalZone: topMechanicalY !== undefined && shaftTopY !== undefined ? { bottomY: topMechanicalY, topY: shaftTopY } : undefined,
    cabinLevelIndex: index, cabinElevationY: index !== undefined && Number.isInteger(index) && index >= 0 ? elevations[index] : undefined }
}

export function getVerticalAnchor(model: PassengerVerticalModel, anchor: VerticalAnchor, counterweightY?: Metres): Metres | undefined {
  const anchors: Record<VerticalAnchor, Metres | undefined> = { 'pit-bottom': model.pitBottomY,
    'lowest-landing': model.lowestLandingY, 'highest-landing': model.highestLandingY, 'shaft-top': model.shaftTopY,
    'top-mechanical': model.topMechanicalY, 'cabin-floor': model.cabinElevationY, 'counterweight-center': counterweightY }
  return anchors[anchor]
}

/** Resolve one independent serializable record; never mutate source data or fall back to stale world Y. */
export function resolveVerticalRecord<T>(record: T | undefined, model: PassengerVerticalModel, missing: string[], path: string, counterweightY?: Metres): T | undefined {
  if (record === undefined) return undefined
  const before = missing.length
  function visit(value: unknown, at: string): unknown {
    if (Array.isArray(value)) return value.map((entry, i) => visit(entry, `${at}.${i}`))
    if (!value || typeof value !== 'object') return value
    const object = value as Record<string, unknown>
    const anchor = object.verticalAnchor ?? object.elevationAnchor
    if (anchor !== undefined) {
      const y = getVerticalAnchor(model, anchor as VerticalAnchor, counterweightY)
      if (y === undefined) { missing.push(`${at}.anchor.${String(anchor)}`); return undefined }
      const field = object.verticalAnchor !== undefined ? 'yMm' : 'elevationMm'
      const rest = Object.fromEntries(Object.entries(object).filter(([key]) => key !== 'verticalAnchor' && key !== 'elevationAnchor'))
      // The normalized millimetre record feeds existing pure component factories once, then converts to metres.
      return visit({ ...rest, [field]: millimetres(metresToMillimetres(y) + Number(object[field])) }, at)
    }
    return Object.fromEntries(Object.entries(object).filter(([key]) => key !== 'verticalAnchor' && key !== 'elevationAnchor')
      .map(([key, child]) => [key, visit(child, `${at}.${key}`)]))
  }
  const resolved = visit(record, path)
  return missing.length === before ? resolved as T : undefined
}
