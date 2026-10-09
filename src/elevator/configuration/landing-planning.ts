import { z } from 'zod'
import { millimetres, type Millimetres } from '../../engineering'

/** Metadata aligned with the existing elevation array, not a second vertical model. */
export const landingSettingsSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  frontAccess: z.boolean().optional(),
  rearAccess: z.boolean().optional(),
}).strict()
export type LandingSettings = z.infer<typeof landingSettingsSchema>
export const levelElevationsSchema = z.array(z.number().finite().transform(millimetres).nullable()).readonly()

export interface LandingPlanningData {
  readonly stopCount?: number
  /** null is an explicitly unresolved elevation; it survives JSON without fabricated geometry. */
  readonly levelElevationsMm?: readonly (Millimetres | null)[]
  readonly landingSettings?: readonly LandingSettings[]
  readonly floorHeightMm?: Millimetres
  readonly storeyHeightsMm?: readonly Millimetres[]
  readonly throughCar?: boolean
  readonly frontAccess?: boolean
  readonly rearAccess?: boolean
}
export interface NormalizedLanding {
  readonly id: string
  readonly index: number
  readonly label?: string
  readonly elevationMm: Millimetres
  readonly frontAccess?: boolean
  readonly rearAccess?: boolean
}
export type LandingIssueCode = 'missing-elevation' | 'invalid-elevation-order' | 'invalid-stop-count'
  | 'inconsistent-stop-references' | 'unserved-stop' | 'unsupported-front-access' | 'unsupported-rear-access'
  | 'access-unavailable' | 'landing-door-shaft-conflict'
export interface LandingIssue {
  readonly code: LandingIssueCode
  readonly status: 'invalid' | 'unknown'
  readonly levelId?: string
}

export function landingAccessDefaults(configuration: LandingPlanningData, passenger: boolean) {
  return { frontAccess: passenger ? true : configuration.frontAccess,
    rearAccess: passenger ? configuration.throughCar : configuration.rearAccess }
}

/** Legacy uniform inputs are expanded deterministically, never persisted on an unrelated edit. */
export function getLandingRows(configuration: LandingPlanningData, passenger: boolean) {
  const count = passenger && configuration.levelElevationsMm && !configuration.landingSettings
    ? configuration.levelElevationsMm.length : configuration.stopCount ?? configuration.levelElevationsMm?.length ?? 0
  if (!Number.isInteger(count) || count < 1) return []
  let elevation: number | null = 0
  return Array.from({ length: count }, (_, index) => {
    if (index > 0) {
      const height = passenger ? configuration.floorHeightMm : configuration.storeyHeightsMm?.[index - 1]
      elevation = elevation !== null && height !== undefined && height > 0 ? elevation + height : null
    }
    const value = configuration.levelElevationsMm !== undefined
      ? configuration.levelElevationsMm[index] ?? null
      : (index === 0 && (passenger ? configuration.floorHeightMm === undefined : configuration.storeyHeightsMm === undefined))
        ? null : elevation
    const setting = configuration.landingSettings?.[index]
    return { ...landingAccessDefaults(configuration, passenger), ...setting,
      id: setting?.id ?? `level-${index + 1}`, label: setting?.label ?? `Haltestelle ${index + 1}`,
      index, elevationMm: value === null ? null : millimetres(value) }
  })
}

export function normalizeLandings(configuration: LandingPlanningData, passenger: boolean): {
  readonly levels: readonly NormalizedLanding[]; readonly issues: readonly LandingIssue[]
} {
  const rows = getLandingRows(configuration, passenger), issues: LandingIssue[] = []
  const count = passenger && configuration.levelElevationsMm && !configuration.landingSettings
    ? configuration.levelElevationsMm.length : configuration.stopCount ?? configuration.levelElevationsMm?.length
  if (count !== undefined && (!Number.isInteger(count) || count < 1)) issues.push({ code: 'invalid-stop-count', status: 'invalid' })
  if (!configuration.levelElevationsMm && (passenger
    ? configuration.floorHeightMm !== undefined && (!Number.isFinite(configuration.floorHeightMm) || configuration.floorHeightMm <= 0)
    : configuration.storeyHeightsMm !== undefined && (configuration.storeyHeightsMm.length !== (count ?? 0)-1 ||
      configuration.storeyHeightsMm.some((height)=>!Number.isFinite(height) || height<=0)))) {
    issues.push({code:'invalid-elevation-order',status:'invalid'})
  }
  if ((configuration.levelElevationsMm && configuration.levelElevationsMm.length !== count) ||
    (configuration.landingSettings && (configuration.landingSettings.length !== count ||
      new Set(configuration.landingSettings.map((row) => row.id)).size !== configuration.landingSettings.length))) {
    issues.push({ code: 'inconsistent-stop-references', status: 'invalid' })
  }
  // Goods/Auto already reject ambiguous explicit elevations + interval lists.
  if (!passenger && configuration.levelElevationsMm && configuration.storeyHeightsMm) {
    issues.push({ code: 'inconsistent-stop-references', status: 'invalid' })
  }
  let previous: number | undefined
  for (const row of rows) {
    if (row.elevationMm === null) issues.push({ code: 'missing-elevation', status: 'unknown', levelId: row.id })
    else {
      if (!Number.isFinite(row.elevationMm) || (previous !== undefined && row.elevationMm <= previous)) {
        issues.push({ code: 'invalid-elevation-order', status: 'invalid', levelId: row.id })
      }
      previous = row.elevationMm
    }
    if (configuration.landingSettings) {
      if (row.frontAccess === false && row.rearAccess === false) issues.push({ code: 'unserved-stop', status: 'invalid', levelId: row.id })
      else if (row.frontAccess === undefined || row.rearAccess === undefined) issues.push({ code: 'access-unavailable', status: 'unknown', levelId: row.id })
      if (row.frontAccess && !passenger && configuration.frontAccess !== true) issues.push({ code: 'unsupported-front-access', status: configuration.frontAccess === false ? 'invalid' : 'unknown', levelId: row.id })
      if (row.rearAccess && (configuration.throughCar !== true || (!passenger && configuration.rearAccess !== true))) {
        issues.push({ code: 'unsupported-rear-access', status: configuration.throughCar === false || (!passenger && configuration.rearAccess === false) ? 'invalid' : 'unknown', levelId: row.id })
      }
    }
  }
  // No silently sorted/merged levels: invalid vertical input cannot become a travel route.
  const invalidVertical = issues.some((issue) => issue.status === 'invalid' &&
    ['invalid-elevation-order', 'invalid-stop-count', 'inconsistent-stop-references'].includes(issue.code))
  const levels = invalidVertical ? [] : rows.flatMap((row) => row.elevationMm === null ? [] : [{ ...row, elevationMm: row.elevationMm }])
  return { levels, issues }
}

export function isLandingSideServed(level: { readonly frontAccess?: boolean; readonly rearAccess?: boolean }, side: 'front' | 'rear') {
  const key = side === 'front' ? 'frontAccess' : 'rearAccess'
  // Older manually constructed normalized models have no access metadata.
  return Object.hasOwn(level, key) ? level[key] === true : true
}

/** Clear opening containment only, no manufactured frame, clearances or normative margins. */
export function validateLandingOpenings(levels: readonly NormalizedLanding[], entrances: readonly {
  readonly side: 'front' | 'rear'; readonly widthMm: Millimetres; readonly heightMm: Millimetres
}[], shaft?: {readonly minX: Millimetres;readonly maxX: Millimetres;readonly minY: Millimetres;readonly maxY: Millimetres}): readonly LandingIssue[] {
  if (!shaft) return []
  return levels.flatMap((level)=>entrances.some((entrance)=>isLandingSideServed(level,entrance.side) &&
    (-entrance.widthMm/2 < shaft.minX || entrance.widthMm/2 > shaft.maxX ||
      level.elevationMm < shaft.minY || level.elevationMm+entrance.heightMm > shaft.maxY))
    ? [{code:'landing-door-shaft-conflict' as const,status:'invalid' as const,levelId:level.id}] : [])
}

/** Editor commands are pure. Explicit edits clear the legacy interval source. IDs survive deletion. */
export function editLanding<T extends LandingPlanningData>(configuration: T, passenger: boolean, index: number,
  update: Partial<LandingSettings> & { readonly elevationMm?: Millimetres | null }): T {
  const rows = getLandingRows(configuration, passenger)
  if (!rows[index]) return configuration
  const next = rows.map((row, i) => i === index ? { ...row, ...update, id: row.id } : row)
  return withLandingRows(configuration, next)
}

function withLandingRows<T extends LandingPlanningData>(configuration: T, rows: ReturnType<typeof getLandingRows>): T {
  const next = { ...configuration, stopCount: rows.length,
    levelElevationsMm: rows.map((row) => row.elevationMm),
    landingSettings: rows.map(({ id, label, frontAccess, rearAccess }) => ({ id, label, frontAccess, rearAccess })) }
  // Omit, rather than storing undefined: Passenger's strict schema has no interval-list field.
  return Object.fromEntries(Object.entries(next).filter(([key]) => key !== 'storeyHeightsMm')) as unknown as T
}

export function removeLanding<T extends LandingPlanningData>(configuration: T, passenger: boolean, id: string): T {
  const rows = getLandingRows(configuration, passenger).filter((row) => row.id !== id)
  return withLandingRows(configuration, rows)
}

/** Explicit user command, never run as a side effect of a scalar configuration edit. */
export function applyUniformLandingHeight<T extends LandingPlanningData>(configuration: T, height: Millimetres): T {
  if (!Number.isFinite(height) || height <= 0) return configuration
  const count = configuration.stopCount ?? configuration.levelElevationsMm?.length
  if (!count || !Number.isInteger(count) || count < 1) return configuration
  const first = configuration.levelElevationsMm === undefined ? millimetres(0) : configuration.levelElevationsMm[0]
  if (first === null || first === undefined) return configuration
  return {...configuration,levelElevationsMm:Array.from({length:count},(_,index)=>millimetres(first+index*height))}
}

export function resizeLandings<T extends LandingPlanningData>(configuration: T, passenger: boolean, count: number): T {
  if (!Number.isInteger(count) || count < 1) return { ...configuration, stopCount: count }
  const rows = getLandingRows(configuration, passenger).slice(0, count)
  const used = new Set(configuration.landingSettings?.map((row) => row.id) ?? rows.map((row) => row.id))
  const heights = configuration.storeyHeightsMm
  const uniform = passenger ? configuration.floorHeightMm
    : heights?.length && heights.every((height) => height === heights[0]) ? heights[0] : undefined
  while (rows.length < count) {
    let serial = rows.length + 1
    while (used.has(`level-${serial}`)) serial++
    const id = `level-${serial}`; used.add(id)
    const previous = rows.at(-1)?.elevationMm
    const elevationMm = uniform !== undefined && uniform > 0 && previous !== null && previous !== undefined
      ? millimetres(previous + uniform) : null
    rows.push({ ...landingAccessDefaults(configuration, passenger), id, index: rows.length,
      label: `Haltestelle ${rows.length + 1}`, elevationMm })
  }
  return withLandingRows(configuration, rows)
}

/** Existing count field and editor always share the same resize command once customized. */
export function updateLandingCount<T extends LandingPlanningData>(configuration: T, update: Partial<NoInfer<T>>, passenger: boolean): T {
  const next = { ...configuration, ...update }
  if (update.stopCount === undefined || update.stopCount === configuration.stopCount ||
    Object.hasOwn(update, 'levelElevationsMm') || Object.hasOwn(update, 'landingSettings') ||
    (!configuration.levelElevationsMm && !configuration.landingSettings)) return next
  return { ...resizeLandings(configuration, passenger, update.stopCount), ...update }
}
