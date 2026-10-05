import type {
  RegisteredLiftConfiguration,
  RegisteredLiftFamily,
} from '../../elevator'

export const LIFTPLAN_PROJECT_SCHEMA_VERSION = 'liftplan-project-v1' as const

export interface LiftPlanProject {
  readonly id: string
  readonly name: string
  readonly liftFamily: RegisteredLiftFamily
  readonly configuration: RegisteredLiftConfiguration
  readonly createdAt: string
  readonly updatedAt: string
  readonly schemaVersion: typeof LIFTPLAN_PROJECT_SCHEMA_VERSION
  readonly projectVersion: number
}

export interface CreateLiftPlanProjectInput {
  readonly projectId?: string
  readonly projectName?: string
  readonly liftFamily?: RegisteredLiftFamily
  readonly createdAt?: string
}
