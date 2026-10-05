import type { GoodsLiftDrawingContext } from './goods-lift-technical-drawings'
import {
  createGoodsLiftDoorElevationDrawing,
  createGoodsLiftPlanDrawing,
  createGoodsLiftSectionDrawing,
} from './goods-lift-technical-drawings'
import type { CarLiftDrawingContext } from './car-lift-technical-drawings'
import {
  createCarLiftDoorElevationDrawing,
  createCarLiftPlanDrawing,
  createCarLiftSectionDrawing,
} from './car-lift-technical-drawings'
import type { PassengerDrawingContext } from './passenger-technical-drawings'
import {
  createPassengerDoorElevationDrawing,
  createPassengerPlanDrawing,
  createPassengerSectionDrawing,
  getAvailableDoorSides,
} from './passenger-technical-drawings'
import type { TechnicalDrawingDocument, TechnicalDrawingScale } from './technical-drawing'

export type LiftFamilyDrawingContext = PassengerDrawingContext | GoodsLiftDrawingContext | CarLiftDrawingContext
export type LiftDrawingSide = 'front' | 'rear'

export interface LiftDrawingLevel {
  readonly id: string
  readonly index: number
}

function contextFamily(context: LiftFamilyDrawingContext): 'passenger' | 'goods' | 'car' {
  if ('inputs' in context) return 'passenger'
  return context.model.family
}

export function getLiftDrawingLevels(context: LiftFamilyDrawingContext | undefined): readonly LiftDrawingLevel[] {
  if (!context) return []
  return 'inputs' in context ? context.inputs.installation.levels : context.model.levels
}

export function getLiftDrawingSides(context: LiftFamilyDrawingContext | undefined): readonly LiftDrawingSide[] {
  if (!context) return []
  if ('inputs' in context) return getAvailableDoorSides(context)
  return context.model.entrances.map((entry) => entry.side)
}

export function createLiftPlanDrawing(
  context: LiftFamilyDrawingContext,
  scale: TechnicalDrawingScale,
): TechnicalDrawingDocument {
  const family = contextFamily(context)
  if (family === 'passenger') return createPassengerPlanDrawing(context as PassengerDrawingContext, scale)
  if (family === 'goods') return createGoodsLiftPlanDrawing(context as GoodsLiftDrawingContext, scale)
  return createCarLiftPlanDrawing(context as CarLiftDrawingContext, scale)
}

export function createLiftSectionDrawing(
  context: LiftFamilyDrawingContext,
  scale: TechnicalDrawingScale,
): TechnicalDrawingDocument {
  const family = contextFamily(context)
  if (family === 'passenger') return createPassengerSectionDrawing(context as PassengerDrawingContext, scale)
  if (family === 'goods') return createGoodsLiftSectionDrawing(context as GoodsLiftDrawingContext, scale)
  return createCarLiftSectionDrawing(context as CarLiftDrawingContext, scale)
}

export function createLiftDoorElevationDrawing(
  context: LiftFamilyDrawingContext,
  selection: { readonly levelId?: string; readonly side: LiftDrawingSide },
  scale: TechnicalDrawingScale,
): TechnicalDrawingDocument {
  const family = contextFamily(context)
  if (family === 'passenger') {
    return createPassengerDoorElevationDrawing(context as PassengerDrawingContext, selection, scale)
  }
  if (family === 'goods') {
    return createGoodsLiftDoorElevationDrawing(context as GoodsLiftDrawingContext, selection, scale)
  }
  return createCarLiftDoorElevationDrawing(context as CarLiftDrawingContext, selection, scale)
}
