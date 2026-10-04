import { z } from 'zod'
import {
  componentDimensionSchema as dimension, componentPointSchema as point,
  componentSizeSchema as size, componentBoxSchema as box, componentProvenance as provenance,
  rotationalWheelDataSchema,
} from './rotational-wheel-data'

export const DOOR_OPENING_TYPES = ['center-opening-2', 'side-opening-2', 'center-opening-4', 'telescopic'] as const
export const entranceSideSchema = z.enum(['front', 'rear'])
const opening = z.object({ widthMm: dimension, heightMm: dimension }).strict()
const part = box.extend({ id: z.string().min(1) }).strict()
const cylinder = z.object({ id: z.string().min(1), centerMm: point, diameterMm: dimension,
  lengthMm: dimension, axis: z.enum(['x', 'y', 'z']) }).strict()

export const doorAssemblyDataSchema = z.object({
  ...provenance, openingType: z.enum(DOOR_OPENING_TYPES), panelCount: z.number().int().positive(),
  sideOpeningDirection: z.enum(['left', 'right']).optional(), panelThicknessMm: dimension,
  panelOverlapMm: dimension.optional(), panelDepthOffsetsMm: z.array(dimension).readonly(),
  panelTravelMm: z.array(point).readonly(),
  frame: z.object({ jambWidthMm: dimension, jambDepthMm: dimension, headerHeightMm: dimension,
    headerDepthMm: dimension, depthOffsetMm: dimension }).strict().optional(),
  sill: z.object({ widthMm: dimension, depthMm: dimension, heightMm: dimension, depthOffsetMm: dimension,
    grooves: z.array(z.object({ depthOffsetMm: dimension, widthMm: dimension, depthMm: dimension }).strict()).readonly(),
  }).strict().optional(),
  track: z.object({ widthMm: dimension, heightMm: dimension, depthMm: dimension,
    aboveOpeningMm: dimension, depthOffsetMm: dimension,
    // Mount offsets are relative to the opening's top centre, not an absolute storey elevation.
    mounts: z.array(part).readonly(),
  }).strict().optional(),
  hanger: z.object({ carrierSizeMm: size, connectorSizeMm: size, aboveOpeningMm: dimension, depthOffsetMm: dimension,
    rollers: z.array(cylinder).readonly(),
  }).strict().optional(),
  bottomGuide: z.object({ sizeMm: size, depthOffsetsMm: z.array(dimension).readonly() }).strict().optional(),
}).strict()

const beltNode = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('contact'), wheelId: z.string().min(1), entryAngleRad: z.number().finite(), exitAngleRad: z.number().finite() }).strict(),
  z.object({ kind: z.literal('point'), positionMm: point }).strict(),
])
export const doorOperatorDataSchema = z.object({
  ...provenance, offsetXMm: dimension, aboveOpeningMm: dimension, depthOffsetMm: dimension,
  housing: box, parts: z.array(part).readonly(), cylinders: z.array(cylinder).readonly(),
  pulleys: z.array(rotationalWheelDataSchema).readonly(),
  drivePath: z.object({ ...provenance, diameterMm: dimension,
    route: z.array(beltNode).min(2).readonly(),
  }).strict().optional(),
}).strict()

export const doorCouplingDataSchema = z.object({
  ...provenance, panelIndex: z.number().int().nonnegative(), boxes: z.array(part).min(1).readonly(),
  cylinders: z.array(cylinder).readonly(), interfacePointMm: point,
}).strict()
export const doorInterlockDataSchema = z.object({
  ...provenance, offsetXMm: dimension, aboveOpeningMm: dimension, depthOffsetMm: dimension,
  boxes: z.array(part).min(1).readonly(), cylinders: z.array(cylinder).readonly(),
}).strict()

export const cabinDoorEntranceDataSchema = z.object({
  ...provenance, id: z.string().min(1), side: entranceSideSchema, axisXMm: dimension,
  opening: opening.optional(), assembly: doorAssemblyDataSchema.optional(),
  operator: doorOperatorDataSchema.optional(), coupling: doorCouplingDataSchema.optional(),
}).strict()
const landingOverride = z.object({
  levelId: z.string().min(1), opening: opening.optional(), separationMm: dimension.optional(),
  assembly: doorAssemblyDataSchema.optional(), coupling: doorCouplingDataSchema.optional(),
  interlock: doorInterlockDataSchema.optional(),
}).strict()
export const landingDoorSeriesDataSchema = z.object({
  ...provenance, id: z.string().min(1), cabinEntranceId: z.string().min(1), side: entranceSideSchema,
  // Explicit separation between the cabin-face and landing-opening reference planes. Not a regulatory sill gap.
  separationMm: dimension, opening: opening.optional(), assembly: doorAssemblyDataSchema.optional(),
  coupling: doorCouplingDataSchema.optional(), interlock: doorInterlockDataSchema.optional(),
  overrides: z.array(landingOverride).readonly().optional(),
}).strict()

export const passengerDoorSystemDataSchema = z.object({
  cabin: z.array(cabinDoorEntranceDataSchema).readonly().optional(),
  // An explicit series applies its supplied specification independently to each normalized level.
  landings: z.array(landingDoorSeriesDataSchema).readonly().optional(),
}).strict()
export type DoorOpeningType = (typeof DOOR_OPENING_TYPES)[number]
export type DoorAssemblyData = z.infer<typeof doorAssemblyDataSchema>
export type DoorCylinderData = z.infer<typeof cylinder>
export type DoorOperatorData = z.infer<typeof doorOperatorDataSchema>
export type DoorCouplingData = z.infer<typeof doorCouplingDataSchema>
export type DoorInterlockData = z.infer<typeof doorInterlockDataSchema>
export type CabinDoorEntranceData = z.infer<typeof cabinDoorEntranceDataSchema>
export type LandingDoorSeriesData = z.infer<typeof landingDoorSeriesDataSchema>
export type PassengerDoorSystemData = z.infer<typeof passengerDoorSystemDataSchema>
