import { z } from 'zod'
import { millimetres } from '../../engineering'

export const VERTICAL_ANCHORS = ['pit-bottom', 'lowest-landing', 'highest-landing', 'shaft-top', 'top-mechanical', 'cabin-floor', 'counterweight-center'] as const
export const verticalAnchorSchema = z.enum(VERTICAL_ANCHORS)
const dimension = z.number().finite().transform(millimetres)
// Without an anchor this is an absolute world point. With an anchor yMm is an explicit offset.
export const verticalPointSchema = z.object({ xMm: dimension, yMm: dimension, zMm: dimension,
  verticalAnchor: verticalAnchorSchema.optional(),
}).strict()
export type VerticalAnchor = (typeof VERTICAL_ANCHORS)[number]
export type VerticalPlanningPoint = z.infer<typeof verticalPointSchema>
