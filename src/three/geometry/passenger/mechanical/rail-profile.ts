import type { ComponentDataSource, RailProfileData } from '../../../../elevator/configuration/mechanical-component-data'
import { metres, millimetresToMetres, type Metres } from '../../../../engineering'

export type ProfilePoint = readonly [Metres, Metres]

export interface TRailProfile {
  readonly source: ComponentDataSource
  readonly reference?: string
  readonly depth: Metres
  readonly flangeWidth: Metres
  readonly flangeThickness: Metres
  readonly webThickness: Metres
  readonly headWidth: Metres
  readonly headThickness: Metres
  readonly points: readonly ProfilePoint[]
}

/** Local U crosses the flange; V points toward the moving assembly. The head tip is V=0. */
export function createTRailProfile(data: RailProfileData): TRailProfile | undefined {
  const { source, reference, ...dimensions } = data
  if (!Object.values(dimensions).every((value) => Number.isFinite(value) && value > 0)) return undefined
  const d = millimetresToMetres(data.profileDepthMm)
  const b = millimetresToMetres(data.flangeWidthMm)
  const t = millimetresToMetres(data.flangeThicknessMm)
  const w = millimetresToMetres(data.webThicknessMm)
  const h = millimetresToMetres(data.headWidthMm)
  const k = millimetresToMetres(data.headThicknessMm)
  if (t + k >= d || w >= h || h > b) return undefined
  const point = (u: number, v: number): ProfilePoint => [metres(u), metres(v)]
  return {
    source, reference, depth: d, flangeWidth: b, flangeThickness: t,
    webThickness: w, headWidth: h, headThickness: k,
    points: [
      point(-b / 2, -d), point(b / 2, -d), point(b / 2, -d + t),
      point(w / 2, -d + t), point(w / 2, -k), point(h / 2, -k),
      point(h / 2, 0), point(-h / 2, 0), point(-h / 2, -k),
      point(-w / 2, -k), point(-w / 2, -d + t), point(-b / 2, -d + t),
    ],
  }
}
