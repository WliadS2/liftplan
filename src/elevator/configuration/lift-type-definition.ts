import type { ZodType } from 'zod'
import type { LiftConfiguration } from '../models/lift-configuration'
import type { LiftImplementationStatus } from '../types/lift-implementation-status'

export interface LiftUiSection {
  readonly id: string
  readonly order: number
  readonly titleKey: string
}

export interface FutureModuleReference {
  readonly id: string
  readonly status: 'planned' | 'available'
}

export const LIFT_CAPABILITY_NAMES = [
  'configuration', 'normalization', 'validation', 'geometry', 'three',
  'simulation', 'drawings', 'pdf', 'dxf', 'persistence', 'migration',
] as const
export type LiftCapabilityName = (typeof LIFT_CAPABILITY_NAMES)[number]
export interface LiftCapability {
  readonly status: 'available' | 'unavailable'
  readonly moduleId?: string
}
export type LiftCapabilities = Readonly<Record<LiftCapabilityName, LiftCapability>>

export interface LiftTypeDefinition<
  Configuration extends LiftConfiguration,
> {
  readonly id: Configuration['family']
  readonly displayName: string
  readonly description: string
  readonly implementationStatus: LiftImplementationStatus
  readonly configurationSchema: ZodType<Configuration>
  readonly createDefaultConfiguration: (projectName: string) => Configuration
  readonly engineeringModule: FutureModuleReference
  readonly geometryModule: FutureModuleReference
  readonly capabilities: LiftCapabilities
  readonly uiSections: readonly LiftUiSection[]
}
