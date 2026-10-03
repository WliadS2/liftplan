import type { LiftFamily } from '../types/lift-family'

export interface LiftConfiguration<
  Family extends LiftFamily = LiftFamily,
  Parameters = unknown,
> {
  readonly family: Family
  readonly schemaVersion: number
  readonly parameters: Parameters
}
