import { z } from 'zod'
import { millimetres, type Millimetres } from '../../engineering'

/** Explicit generic carrier sections, not equipment selection or a manufacturer catalogue.
 * Optional and additive: normal projects never receive component dimensions by default. */
export type CarrierComponentSource = 'planning' | 'verified' | 'demo' | 'visualization'
export interface CarrierMechanicalPlanning {
  readonly source: CarrierComponentSource
  readonly floorThicknessMm?: Millimetres
  readonly frame?: {
    readonly orientation: 'x' | 'z'
    readonly spacingMm: Millimetres
    readonly uprightWidthMm: Millimetres
    readonly uprightDepthMm: Millimetres
    readonly lowerMemberHeightMm: Millimetres
    readonly upperMemberHeightMm: Millimetres
  }
  readonly rails?: { readonly widthMm: Millimetres; readonly depthMm: Millimetres }
  readonly shoes?: {
    readonly widthMm: Millimetres; readonly heightMm: Millimetres; readonly depthMm: Millimetres
    readonly lowerInsetMm: Millimetres; readonly upperInsetMm: Millimetres
  }
  readonly buffers?: readonly {
    readonly id: string; readonly xMm: Millimetres; readonly zMm: Millimetres
    readonly baseWidthMm: Millimetres; readonly baseDepthMm: Millimetres; readonly baseHeightMm: Millimetres
    readonly bodyWidthMm: Millimetres; readonly bodyDepthMm: Millimetres; readonly bodyHeightMm: Millimetres
    readonly contactWidthMm: Millimetres; readonly contactDepthMm: Millimetres; readonly contactHeightMm: Millimetres
  }[]
}
const mm = z.number().finite().transform(millimetres)
export const carrierMechanicalPlanningSchema = z.object({
  source: z.enum(['planning', 'verified', 'demo', 'visualization']),
  floorThicknessMm: mm.optional(),
  frame: z.object({
    orientation: z.enum(['x', 'z']), spacingMm: mm,
    uprightWidthMm: mm, uprightDepthMm: mm, lowerMemberHeightMm: mm, upperMemberHeightMm: mm,
  }).strict().optional(),
  rails: z.object({ widthMm: mm, depthMm: mm }).strict().optional(),
  shoes: z.object({ widthMm: mm, heightMm: mm, depthMm: mm, lowerInsetMm: mm, upperInsetMm: mm }).strict().optional(),
  buffers: z.array(z.object({
    id: z.string().min(1), xMm: mm, zMm: mm,
    baseWidthMm: mm, baseDepthMm: mm, baseHeightMm: mm,
    bodyWidthMm: mm, bodyDepthMm: mm, bodyHeightMm: mm,
    contactWidthMm: mm, contactDepthMm: mm, contactHeightMm: mm,
  }).strict()).readonly().optional(),
}).strict()
