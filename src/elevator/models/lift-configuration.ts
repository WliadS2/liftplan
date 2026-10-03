import type { LiftFamily } from '../types/lift-family'

export interface LiftConfiguration<
  Family extends LiftFamily = LiftFamily,
  SchemaVersion extends string = string,
> {
  readonly family: Family
  readonly schemaVersion: SchemaVersion
}
