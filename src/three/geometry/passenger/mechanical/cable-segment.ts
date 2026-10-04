import type { Metres } from '../../../../engineering'
import type { MechanicalPoint } from './passenger-mechanical-layout'

/** Shared render-neutral cable primitive, not a suspension/safety-system domain contract. */
export type CableSegment =
  | { readonly kind: 'line'; readonly start: MechanicalPoint; readonly end: MechanicalPoint }
  | { readonly kind: 'arc'; readonly sheaveId: string; readonly center: MechanicalPoint; readonly rotationY: number;
      readonly radius: Metres; readonly axialOffset: Metres; readonly entryAngle: number; readonly exitAngle: number }
