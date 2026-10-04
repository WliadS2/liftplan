import { z } from 'zod'
import {
  componentDimensionSchema as dimension, componentProvenance as provenance,
  componentPointSchema as point, componentBoxSchema as box,
  rotationalWheelDataSchema,
} from './rotational-wheel-data'
import { verticalAnchorSchema, verticalPointSchema } from './vertical-placement-data'

const worldBox = box.extend({ centerMm: verticalPointSchema, rotationYRad: z.number().finite() }).strict()
const worldWheel = rotationalWheelDataSchema.extend({ originMm: verticalPointSchema }).strict()
export const safetyWheelAssemblyDataSchema = z.object({
  ...provenance,
  // Local housing/base geometry uses the wheel's explicit origin and Y rotation.
  wheel: worldWheel,
  shaftLengthMm: dimension, housing: z.array(box).min(1).readonly(), base: box,
  supports: z.array(worldBox).min(1).readonly(),
  tensionDevice: box.optional(),
}).strict()

export const safetyGearDataSchema = z.object({
  ...provenance, id: z.string().min(1), side: z.enum(['left', 'right']), railId: z.string().min(1),
  kind: z.enum(['generic', 'progressive', 'instantaneous']), elevationMm: dimension, elevationAnchor: verticalAnchorSchema.optional(),
  heightMm: dimension, bodyDepthMm: dimension, wallThicknessMm: dimension,
  slotWidthMm: dimension, slotDepthMm: dimension, railTipGapMm: dimension,
  mountingPlateThicknessMm: dimension, mountingPlateWidthMm: dimension,
  linkagePointLocalMm: point,
}).strict()

export const governorLinkageDataSchema = z.object({
  ...provenance, id: z.string().min(1), ropeConnectionMm: verticalPointSchema,
  clamp: worldBox, rodDiameterMm: dimension.optional(),
  paths: z.array(z.object({ id: z.string().min(1), gearId: z.string().min(1),
    pointsMm: z.array(verticalPointSchema).min(2).readonly(),
  }).strict()).readonly().optional(),
}).strict()

const routeNode = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('contact'), wheel: z.enum(['governor', 'tension']),
    entryAngleRad: z.number().finite(), exitAngleRad: z.number().finite() }).strict(),
  z.object({ kind: z.literal('linkage'), linkageId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('point'), positionMm: verticalPointSchema }).strict(),
])
export const governorRopeDataSchema = z.object({
  ...provenance, diameterMm: dimension.optional(),
  // One explicit closed loop. No suspension ratio or rated-speed-derived sizing.
  route: z.array(routeNode).min(3).superRefine((nodes, context) => {
    nodes.forEach((node, i) => {
      const previous = nodes[i - 1]
      const zeroArc = node.kind === 'contact' && node.entryAngleRad === node.exitAngleRad
      const zeroPoint = node.kind === 'point' && previous?.kind === 'point' &&
        Object.entries(node.positionMm).every(([key, value]) => previous.positionMm[key as keyof typeof previous.positionMm] === value)
      if (zeroArc || zeroPoint) context.addIssue({ code: 'custom', message: 'zero-length-safety-route', path: [i] })
    })
  }).readonly().optional(),
}).strict()

export const machineBrakeDataSchema = z.object({
  ...provenance, kind: z.literal('generic'), wheel: worldWheel,
  machineMountPartId: z.string().min(1),
  parts: z.array(z.object({ ...box.shape, role: z.enum(['body', 'arm', 'mount']) }).strict()).min(1).readonly(),
}).strict()

export const passengerSafetyDataSchema = z.object({
  governor: safetyWheelAssemblyDataSchema.optional(), tension: safetyWheelAssemblyDataSchema.optional(),
  gears: z.array(safetyGearDataSchema).readonly().optional(), linkage: governorLinkageDataSchema.optional(),
  governorRope: governorRopeDataSchema.optional(), machineBrake: machineBrakeDataSchema.optional(),
}).strict()
export type SafetyWheelAssemblyData = z.infer<typeof safetyWheelAssemblyDataSchema>
export type SafetyGearData = z.infer<typeof safetyGearDataSchema>
export type GovernorLinkageData = z.infer<typeof governorLinkageDataSchema>
export type GovernorRopeData = z.infer<typeof governorRopeDataSchema>
export type MachineBrakeData = z.infer<typeof machineBrakeDataSchema>
export type PassengerSafetyData = z.infer<typeof passengerSafetyDataSchema>
