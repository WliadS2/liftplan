import type { ZodType } from 'zod'
import type { TechnicalValidationResult } from '../../engineering'
import type { LiftConfiguration } from '../models/lift-configuration'

export interface LiftUiSection {
  readonly id: string
  readonly order: number
  readonly titleKey: string
}

export interface LiftTypeDefinition<
  Configuration extends LiftConfiguration,
  CalculationResult = unknown,
  GeometryConfiguration = unknown,
  LoadType extends string = string,
> {
  readonly family: Configuration['family']
  readonly configurationSchema: ZodType<Configuration>
  readonly createDefaultConfiguration: () => Configuration
  readonly validate: (
    configuration: Configuration,
  ) => TechnicalValidationResult
  readonly calculate: (configuration: Configuration) => CalculationResult
  readonly createGeometryConfiguration: (
    configuration: Configuration,
    calculation: CalculationResult,
  ) => GeometryConfiguration
  readonly loadTypes: readonly LoadType[]
  readonly uiSections: readonly LiftUiSection[]
}
