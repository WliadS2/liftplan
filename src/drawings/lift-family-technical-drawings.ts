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
import { isLandingSideServed } from '../elevator/configuration/landing-planning'

export type LiftFamilyDrawingContext = PassengerDrawingContext | GoodsLiftDrawingContext | CarLiftDrawingContext
export type LiftDrawingSide = 'front' | 'rear'

export interface LiftDrawingLevel {
  readonly id: string
  readonly index: number
  readonly label?: string
  readonly frontAccess?: boolean
  readonly rearAccess?: boolean
}

function contextFamily(context: LiftFamilyDrawingContext): 'passenger' | 'goods' | 'car' {
  if ('inputs' in context) return 'passenger'
  return context.model.family
}

export function getLiftDrawingLevels(context: LiftFamilyDrawingContext | undefined): readonly LiftDrawingLevel[] {
  if (!context) return []
  return 'inputs' in context ? context.inputs.installation.levels : context.model.levels
}

export function getLiftDrawingSides(context: LiftFamilyDrawingContext | undefined, levelId?: string): readonly LiftDrawingSide[] {
  if (!context) return []
  const sides = 'inputs' in context ? getAvailableDoorSides(context) : context.model.entrances.map((entry) => entry.side)
  const level = getLiftDrawingLevels(context).find((entry)=>entry.id===levelId)
  return level ? sides.filter((side)=>isLandingSideServed(level,side)) : levelId === undefined ? sides : []
}

export function createLiftPlanDrawing(
  context: LiftFamilyDrawingContext,
  scale: TechnicalDrawingScale,
  levelId?: string,
): TechnicalDrawingDocument {
  const family = contextFamily(context)
  if (family === 'passenger') return createPassengerPlanDrawing(context as PassengerDrawingContext, scale, levelId)
  if (family === 'goods') return createGoodsLiftPlanDrawing(context as GoodsLiftDrawingContext, scale, levelId)
  return createCarLiftPlanDrawing(context as CarLiftDrawingContext, scale, levelId)
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
