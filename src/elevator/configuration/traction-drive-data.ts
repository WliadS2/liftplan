import { z } from 'zod'
import { millimetres } from '../../engineering'
import { COMPONENT_DATA_SOURCES } from './mechanical-component-data'

const dimension = z.number().finite().transform(millimetres)
const provenance = { source: z.enum(COMPONENT_DATA_SOURCES), reference: z.string().optional() }
const point = z.object({ xMm: dimension, yMm: dimension, zMm: dimension }).strict()
const size = z.object({ widthMm: dimension, heightMm: dimension, depthMm: dimension }).strict()
const box = z.object({ centerMm: point, sizeMm: size }).strict()
const transform = { originMm: point, rotationYRad: z.number().finite() }

export const tractionMachineDataSchema = z.object({
  ...provenance, ...transform,
  // All sections use local +Z as the shaft axis, +Y upwards.
  housing: box, bearingSupport: box, base: box,
  motor: z.object({ centerMm: point, diameterMm: dimension, lengthMm: dimension }).strict(),
  shaft: z.object({ centerMm: point, diameterMm: dimension, lengthMm: dimension }).strict(),
}).strict()

export const machineMountDataSchema = z.object({
  ...provenance,
  // Explicit world-space supports. No beam span or support elevation is inferred.
  supports: z.array(z.object({ ...box.shape, rotationYRad: z.number().finite() }).strict()).min(1).readonly(),
}).strict()

export const sheaveDataSchema = z.object({
  ...provenance, id: z.string().min(1), ...transform,
  role: z.enum(['traction', 'deflection', 'car', 'counterweight']),
  diameterMm: dimension, widthMm: dimension,
  hubDiameterMm: dimension, hubWidthMm: dimension, shaftDiameterMm: dimension,
  grooves: z.object({
    count: z.number().int().positive(), spacingMm: dimension, depthMm: dimension, widthMm: dimension,
  }).strict().optional(),
}).strict()

export const hitchDataSchema = z.object({
  ...provenance, id: z.string().min(1),
  attachment: z.enum(['car', 'counterweight', 'fixed']),
  kind: z.enum(['generic', 'wedge', 'socket']),
  ...transform, plate: box,
  // Local central anchor; per-rope lane offsets are supplied by the suspension record.
  anchorMm: point, terminationDiameterMm: dimension, terminationLengthMm: dimension,
}).strict()

export const ropeRouteNodeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hitch'), hitchId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('point'), positionMm: point }).strict(),
  z.object({ kind: z.literal('contact'), sheaveId: z.string().min(1),
    entryAngleRad: z.number().finite(), exitAngleRad: z.number().finite(),
  }).strict(),
])

export const suspensionDataSchema = z.object({
  ...provenance,
  ratio: z.enum(['1:1', '2:1']).optional(),
  ropeCount: z.number().int().positive().optional(), ropeDiameterMm: dimension.optional(),
  grooveIndices: z.array(z.number().int().nonnegative()).readonly().optional(),
  route: z.array(ropeRouteNodeSchema).min(2).superRefine((nodes, context) => {
    nodes.forEach((node, index) => {
      const previous = nodes[index - 1]
      const zeroContact = node.kind === 'contact' && node.entryAngleRad === node.exitAngleRad
      const repeatedPoint = node.kind === 'point' && previous?.kind === 'point' &&
        Object.entries(node.positionMm).every(([key, value]) => previous.positionMm[key as keyof typeof previous.positionMm] === value)
      const repeatedHitch = node.kind === 'hitch' && previous?.kind === 'hitch' && node.hitchId === previous.hitchId
      if (zeroContact || repeatedPoint || repeatedHitch) context.addIssue({ code: 'custom', message: 'zero-length-route', path: [index] })
    })
  }).readonly().optional(),
  carConnectionId: z.string().optional(), counterweightConnectionId: z.string().optional(),
}).strict()

export const tractionDriveDataSchema = z.object({
  machine: tractionMachineDataSchema.optional(), mount: machineMountDataSchema.optional(),
  sheaves: z.array(sheaveDataSchema).readonly().optional(),
  hitches: z.array(hitchDataSchema).readonly().optional(), suspension: suspensionDataSchema.optional(),
}).strict()

export type TractionMachineData = z.infer<typeof tractionMachineDataSchema>
export type MachineMountData = z.infer<typeof machineMountDataSchema>
export type SheaveData = z.infer<typeof sheaveDataSchema>
export type HitchData = z.infer<typeof hitchDataSchema>
export type SuspensionData = z.infer<typeof suspensionDataSchema>
export type RopeRouteNode = z.infer<typeof ropeRouteNodeSchema>
export type TractionDriveData = z.infer<typeof tractionDriveDataSchema>
