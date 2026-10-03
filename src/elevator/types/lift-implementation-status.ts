export const LIFT_IMPLEMENTATION_STATUSES = [
  'available',
  'coming-soon',
] as const

export type LiftImplementationStatus =
  (typeof LIFT_IMPLEMENTATION_STATUSES)[number]
