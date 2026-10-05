import {
  createDefaultLiftConfiguration,
  type RegisteredLiftFamily,
} from '../elevator'
import {
  LIFTPLAN_PROJECT_SCHEMA_VERSION,
  type CreateLiftPlanProjectInput,
  type LiftPlanProject,
} from './models/liftplan-project'

export interface ProjectFactoryDependencies {
  readonly createId?: () => string
  readonly now?: () => string
}

const defaultProjectName = 'Neues LiftPlan-Projekt'

const createDefaultId = () => globalThis.crypto.randomUUID()

const createDefaultTimestamp = () => new Date().toISOString()

export function createLiftPlanProject(
  input: CreateLiftPlanProjectInput = {},
  dependencies: ProjectFactoryDependencies = {},
): LiftPlanProject {
  const projectName = input.projectName ?? defaultProjectName
  const liftFamily = input.liftFamily ?? 'passenger'
  const createdAt = input.createdAt ?? (dependencies.now ?? createDefaultTimestamp)()
  const createId = dependencies.createId ?? createDefaultId

  const configuration = createDefaultLiftConfiguration(liftFamily, projectName)

  return {
    id: input.projectId ?? createId(),
    name: projectName,
    liftFamily,
    configuration,
    createdAt,
    updatedAt: createdAt,
    schemaVersion: LIFTPLAN_PROJECT_SCHEMA_VERSION,
    projectVersion: 0,
  }
}

export function createProjectForLiftFamily(
  project: LiftPlanProject,
  liftFamily: RegisteredLiftFamily,
  dependencies: ProjectFactoryDependencies = {},
): LiftPlanProject {
  const nextProject = createLiftPlanProject(
    {
      projectId: project.id,
      projectName: project.name,
      liftFamily,
      createdAt: project.createdAt,
    },
    dependencies,
  )

  return {
    ...nextProject,
    projectVersion: project.projectVersion,
    updatedAt: (dependencies.now ?? createDefaultTimestamp)(),
  }
}
