import { z } from 'zod'
import { millimetres } from '../../engineering'
import { mechanicalComponentDataSchema } from './mechanical-component-data'
import { tractionDriveDataSchema } from './traction-drive-data'
import { passengerSafetyDataSchema } from './passenger-safety-data'
import { verticalPointSchema } from './vertical-placement-data'

export const COUNTERWEIGHT_ARRANGEMENTS = ['rear', 'left', 'right'] as const
export const RAIL_ORIENTATIONS = ['x', 'z'] as const

const dimension = z.number().finite().transform(millimetres)
const planPosition = z.object({ xMm: dimension, zMm: dimension }).strict()
const point = z.object({ xMm: dimension, yMm: dimension, zMm: dimension }).strict()
const envelope = z.object({
  widthMm: dimension,
  heightMm: dimension,
  depthMm: dimension,
}).strict()

// Structural schema only; spatial checks belong to the pure layout transform.
export const passengerMechanicalPlanningSchema = z.object({
  components: mechanicalComponentDataSchema.optional(),
  drive: tractionDriveDataSchema.optional(),
  safety: passengerSafetyDataSchema.optional(),
  carRailOrientation: z.enum(RAIL_ORIENTATIONS).optional(),
  carRailSpacingMm: dimension.optional(),
  carRailAxisMm: planPosition.optional(),
  carRailPositionsMm: z.tuple([planPosition, planPosition]).readonly().optional(),
  counterweightArrangement: z.enum(COUNTERWEIGHT_ARRANGEMENTS).optional(),
  counterweightOffsetMm: point.partial().optional(),
  counterweightRailSpacingMm: dimension.optional(),
  counterweightRailPositionsMm: z.tuple([planPosition, planPosition]).readonly().optional(),
  carBufferPositionsMm: z.array(verticalPointSchema).readonly().optional(),
  counterweightBufferPositionsMm: z.array(verticalPointSchema).readonly().optional(),
  machine: z.object({
    positionMm: verticalPointSchema.optional(),
    envelopeMm: envelope.optional(),
  }).strict().optional(),
  tractionSheave: z.object({
    positionMm: verticalPointSchema.optional(),
    diameterMm: dimension.optional(),
  }).strict().optional(),
  suspension: z.object({
    arrangement: z.enum(['1:1', '2:1']).optional(),
    pathPointsMm: z.array(verticalPointSchema).readonly().optional(),
  }).strict().optional(),
  zones: z.object({
    bottomOffsetMm: dimension.optional(),
    topOffsetMm: dimension.optional(),
    topInsetMm: dimension.optional(),
  }).strict().optional(),
  driveConcept: z.string().optional(),
}).strict()

export type PassengerMechanicalPlanningInput = z.infer<typeof passengerMechanicalPlanningSchema>
export type MechanicalPlanningPointMm = z.infer<typeof point>
export type MechanicalPlanningPlanPositionMm = z.infer<typeof planPosition>
export type MechanicalPlanningEnvelopeMm = z.infer<typeof envelope>
export type RailOrientation = (typeof RAIL_ORIENTATIONS)[number]
export type SuspensionArrangement = '1:1' | '2:1'
