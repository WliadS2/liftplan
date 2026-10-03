import type { CounterweightPosition } from '../../../../elevator'
import type { Millimetres } from '../../../../engineering'

export interface MechanicalPlanningPointMm {
  readonly xMm: Millimetres
  readonly yMm: Millimetres
  readonly zMm: Millimetres
}

export interface MechanicalPlanningPlanPositionMm {
  readonly xMm: Millimetres
  readonly zMm: Millimetres
}

export interface MechanicalPlanningEnvelopeMm {
  readonly widthMm: Millimetres
  readonly heightMm: Millimetres
  readonly depthMm: Millimetres
}

export type SuspensionArrangement = '1:1' | '2:1'

export interface PassengerMechanicalPlanningInput {
  readonly carRailPositionsMm?: readonly [
    MechanicalPlanningPlanPositionMm,
    MechanicalPlanningPlanPositionMm,
  ]
  readonly counterweightArrangement?: CounterweightPosition
  readonly counterweightRailPositionsMm?: readonly [
    MechanicalPlanningPlanPositionMm,
    MechanicalPlanningPlanPositionMm,
  ]
  readonly carBufferPositionsMm?: readonly MechanicalPlanningPointMm[]
  readonly counterweightBufferPositionsMm?: readonly MechanicalPlanningPointMm[]
  readonly machine?: {
    readonly positionMm?: MechanicalPlanningPointMm
    readonly envelopeMm?: MechanicalPlanningEnvelopeMm
  }
  readonly tractionSheave?: {
    readonly positionMm?: MechanicalPlanningPointMm
    readonly diameterMm?: Millimetres
  }
  readonly suspension?: {
    readonly arrangement?: SuspensionArrangement
    readonly pathPointsMm?: readonly MechanicalPlanningPointMm[]
  }
  readonly zones?: {
    readonly bottomOffsetMm?: Millimetres
    readonly topOffsetMm?: Millimetres
  }
  readonly driveConcept?: string
}
