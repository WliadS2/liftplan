import { z } from 'zod'
import { millimetres, type Millimetres } from '../../engineering'
import type { CarrierBoxMm } from '../models/carrier-mechanical-model'
import type { CarrierComponentSource } from './carrier-mechanical-planning'

export type DriveConcept = 'unspecified' | 'traction' | 'hydraulic'
export type DriveAttachment = 'fixed' | 'carrier' | 'counterweight' | 'plunger'
export interface DrivePointMm {
  readonly x: Millimetres; readonly y: Millimetres; readonly z: Millimetres
  readonly attachment: DriveAttachment
  readonly verticalReference?: 'lowest-stop' | 'highest-stop'
}
export interface DriveBoxPlanning {
  readonly id: string; readonly bounds: CarrierBoxMm
  readonly verticalReference?: 'lowest-stop' | 'highest-stop'
  /** Explicitly declared full shaft-height rail span, not inferred component sizing. */
  readonly verticalSpan?: 'shaft'
}
export interface DriveRoutePlanning { readonly id: string; readonly points: readonly DrivePointMm[] }
export type CarrierDrivePlanning =
  | { readonly concept: 'unspecified' }
  | {
    readonly concept: 'traction'; readonly source: CarrierComponentSource
    readonly machine?: DriveBoxPlanning
    readonly supports?: readonly DriveBoxPlanning[]
    readonly sheaves?: readonly DriveBoxPlanning[]
    readonly carrierHitches?: readonly DriveBoxPlanning[]
    readonly suspension?: readonly DriveRoutePlanning[]
    readonly counterweight?: {
      /** Explicit kinematic planning ratio, not calculated rope traction or certified reeving. */
      readonly travelRatio?: number
      readonly frame?: DriveBoxPlanning; readonly stack?: DriveBoxPlanning
      readonly rails?: readonly DriveBoxPlanning[]
      readonly shoes?: readonly (DriveBoxPlanning & { readonly railId: string })[]
      readonly hitches?: readonly DriveBoxPlanning[]
    }
  }
  | {
    readonly concept: 'hydraulic'; readonly source: CarrierComponentSource
    readonly layout?: 'direct' | 'indirect'
    readonly cylinder?: DriveBoxPlanning; readonly plunger?: DriveBoxPlanning
    readonly base?: DriveBoxPlanning; readonly connection?: DriveBoxPlanning
    readonly pulley?: DriveBoxPlanning & { readonly attachment: 'fixed' | 'carrier' | 'plunger' }
    readonly suspension?: readonly DriveRoutePlanning[]
    readonly travel?: { readonly plungerPerCarrierRatio?: number; readonly availableStrokeMm?: Millimetres }
  }

export interface CarrierSafetyPlanning {
  readonly source: CarrierComponentSource
  readonly gears?: readonly (DriveBoxPlanning & { readonly railId: string })[]
  readonly monitoringPaths?: readonly DriveRoutePlanning[]
}

const mm = z.number().finite().transform(millimetres)
const source = z.enum(['planning', 'verified', 'demo', 'visualization'])
export const driveBoundsSchema = z.object({ minX: mm, maxX: mm, minY: mm, maxY: mm, minZ: mm, maxZ: mm }).strict()
const box = z.object({ id: z.string().min(1), bounds: driveBoundsSchema,
  verticalReference:z.enum(['lowest-stop','highest-stop']).optional(),verticalSpan:z.literal('shaft').optional() }).strict()
const linkedBox = box.extend({ railId: z.string().min(1) }).strict()
const route = z.object({ id: z.string().min(1), points: z.array(z.object({
  x: mm, y: mm, z: mm, attachment: z.enum(['fixed', 'carrier', 'counterweight', 'plunger']),
  verticalReference:z.enum(['lowest-stop','highest-stop']).optional(),
}).strict()).readonly() }).strict()

/** Additive v1 planning extension. No equipment or motion relation is implicitly selected. */
export const carrierDrivePlanningSchema = z.discriminatedUnion('concept', [
  z.object({ concept: z.literal('unspecified') }).strict(),
  z.object({ concept: z.literal('traction'), source,
    machine: box.optional(), supports: z.array(box).readonly().optional(), sheaves: z.array(box).readonly().optional(),
    carrierHitches: z.array(box).readonly().optional(), suspension: z.array(route).readonly().optional(),
    counterweight: z.object({ travelRatio: z.number().finite().optional(), frame: box.optional(), stack: box.optional(),
      rails: z.array(box).readonly().optional(), shoes: z.array(linkedBox).readonly().optional(),
      hitches: z.array(box).readonly().optional(),
    }).strict().optional(),
  }).strict(),
  z.object({ concept: z.literal('hydraulic'), source, layout: z.enum(['direct', 'indirect']).optional(),
    cylinder: box.optional(), plunger: box.optional(), base: box.optional(), connection: box.optional(),
    pulley: box.extend({attachment:z.enum(['fixed','carrier','plunger'])}).strict().optional(),
    suspension: z.array(route).readonly().optional(),
    travel: z.object({ plungerPerCarrierRatio: z.number().finite().optional(), availableStrokeMm: mm.optional() }).strict().optional(),
  }).strict(),
])
export const carrierSafetyPlanningSchema = z.object({ source, gears: z.array(linkedBox).readonly().optional(),
  monitoringPaths: z.array(route).readonly().optional() }).strict()
