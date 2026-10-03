import {
  LIFT_FAMILIES,
  updatePassengerPlanningConfiguration,
  validateLiftConfiguration,
  type PassengerPlanningConfiguration,
  type StructuralValidationResult,
} from '../elevator'
import type { LiftPlanProject } from './models/liftplan-project'

export interface ProjectConfigurationUpdateResult {
  readonly project: LiftPlanProject
  readonly validation: StructuralValidationResult
}

export function replaceProjectConfiguration(
  project: LiftPlanProject,
  configuration: unknown,
  updatedAt: string,
): ProjectConfigurationUpdateResult {
  const validation = validateLiftConfiguration(configuration)

  if (validation.status === 'invalid' || !validation.configuration) {
    return { project, validation }
  }

  const projectName =
    validation.configuration.family === LIFT_FAMILIES.passenger
      ? validation.configuration.projectName
      : project.name

  return {
    project: {
      ...project,
      name: projectName,
      liftFamily: validation.configuration.family,
      configuration: validation.configuration,
      updatedAt,
    },
    validation,
  }
}

export function updateProjectName(
  project: LiftPlanProject,
  projectName: string,
  updatedAt: string,
): LiftPlanProject {
  const configuration =
    project.configuration.family === LIFT_FAMILIES.passenger
      ? updatePassengerPlanningConfiguration(
          project.configuration as PassengerPlanningConfiguration,
          { projectName },
        )
      : project.configuration

  return {
    ...project,
    name: projectName,
    configuration,
    updatedAt,
  }
}
