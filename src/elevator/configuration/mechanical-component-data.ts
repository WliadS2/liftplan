import { z } from 'zod'
import { millimetres } from '../../engineering'

export const COMPONENT_DATA_SOURCES = ['planning', 'verified', 'demo', 'visualization'] as const
export type ComponentDataSource = (typeof COMPONENT_DATA_SOURCES)[number]

const dimension = z.number().finite().transform(millimetres)
const provenance = {
  source: z.enum(COMPONENT_DATA_SOURCES),
  reference: z.string().optional(),
}

// Shape validation only. Geometric compatibility is checked at the render-neutral boundary.
export const railProfileDataSchema = z.object({
  ...provenance,
  profileDepthMm: dimension,
  flangeWidthMm: dimension,
  flangeThicknessMm: dimension,
  webThicknessMm: dimension,
  headWidthMm: dimension,
  headThicknessMm: dimension,
}).strict()

export const slidingGuideShoeDataSchema = z.object({
  ...provenance,
  kind: z.literal('sliding'),
  heightMm: dimension,
  bodyDepthMm: dimension,
  wallThicknessMm: dimension,
  linerThicknessMm: dimension,
  railClearanceMm: dimension,
  mountingPlateThicknessMm: dimension,
  mountingPlateWidthMm: dimension,
  lowerInsetMm: dimension,
  upperInsetMm: dimension,
}).strict()

export type FutureGuideType = 'sliding' | 'roller'

export const carSlingDataSchema = z.object({
  ...provenance,
  uprightWidthMm: dimension,
  uprightDepthMm: dimension,
  channelWallThicknessMm: dimension,
  crossheadHeightMm: dimension,
  crossheadDepthMm: dimension,
  lowerMemberHeightMm: dimension,
  platformMemberWidthMm: dimension,
  platformMemberHeightMm: dimension,
  railToUprightCentreMm: dimension,
}).strict()

export const counterweightFrameDataSchema = z.object({
  ...provenance,
  sideMemberWidthMm: dimension,
  crossMemberHeightMm: dimension,
  channelWallThicknessMm: dimension,
  slabWidthMm: dimension,
  slabHeightMm: dimension,
  slabDepthMm: dimension,
  slabGapMm: dimension,
  slabCount: z.number().int(),
  stackBottomInsetMm: dimension,
}).strict()

export const bufferComponentDataSchema = z.object({
  ...provenance,
  baseWidthMm: dimension,
  baseDepthMm: dimension,
  baseThicknessMm: dimension,
  bodyDiameterMm: dimension,
  bodyHeightMm: dimension,
  plungerDiameterMm: dimension,
  plungerHeightMm: dimension,
  contactDiameterMm: dimension,
  contactThicknessMm: dimension,
}).strict()

export const mechanicalComponentDataSchema = z.object({
  railProfile: railProfileDataSchema.optional(),
  carGuideShoe: slidingGuideShoeDataSchema.optional(),
  counterweightGuideShoe: slidingGuideShoeDataSchema.optional(),
  carSling: carSlingDataSchema.optional(),
  counterweightFrame: counterweightFrameDataSchema.optional(),
  carBuffer: bufferComponentDataSchema.optional(),
  counterweightBuffer: bufferComponentDataSchema.optional(),
}).strict()

export type RailProfileData = z.infer<typeof railProfileDataSchema>
export type SlidingGuideShoeData = z.infer<typeof slidingGuideShoeDataSchema>
export type CarSlingData = z.infer<typeof carSlingDataSchema>
export type CounterweightFrameData = z.infer<typeof counterweightFrameDataSchema>
export type BufferComponentData = z.infer<typeof bufferComponentDataSchema>
export type MechanicalComponentData = z.infer<typeof mechanicalComponentDataSchema>
