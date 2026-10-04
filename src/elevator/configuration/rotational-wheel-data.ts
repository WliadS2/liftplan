import { z } from 'zod'
import { millimetres } from '../../engineering'
import { COMPONENT_DATA_SOURCES } from './mechanical-component-data'

export const componentDimensionSchema = z.number().finite().transform(millimetres)
export const componentProvenance = { source: z.enum(COMPONENT_DATA_SOURCES), reference: z.string().optional() }
export const componentPointSchema = z.object({ xMm: componentDimensionSchema, yMm: componentDimensionSchema, zMm: componentDimensionSchema }).strict()
export const componentSizeSchema = z.object({ widthMm: componentDimensionSchema, heightMm: componentDimensionSchema, depthMm: componentDimensionSchema }).strict()
export const componentBoxSchema = z.object({ centerMm: componentPointSchema, sizeMm: componentSizeSchema }).strict()
export const componentTransform = { originMm: componentPointSchema, rotationYRad: z.number().finite() }
export const rotationalWheelDataSchema = z.object({
  ...componentProvenance, id: z.string().min(1), ...componentTransform,
  diameterMm: componentDimensionSchema, widthMm: componentDimensionSchema,
  hubDiameterMm: componentDimensionSchema, hubWidthMm: componentDimensionSchema, shaftDiameterMm: componentDimensionSchema,
  grooves: z.object({ count: z.number().int().positive(), spacingMm: componentDimensionSchema,
    depthMm: componentDimensionSchema, widthMm: componentDimensionSchema }).strict().optional(),
}).strict()
export type RotationalWheelData = z.infer<typeof rotationalWheelDataSchema>
export type RotationalWheelRole = 'traction' | 'deflection' | 'car' | 'counterweight' | 'governor' | 'tension' | 'brake' | 'door-operator'
