import { validateLiftConfiguration } from '../../elevator'
import type { LiftPlanProject } from '../models/liftplan-project'
import { createLiftPlanProject } from '../project-factory'
import type { ProjectRepository } from './project-repository'
import {
  LIFTPLAN_STORAGE_SCHEMA_VERSION,
  type JsonValue,
  type StoredLiftPlanProject,
  type StoredLiftPlanProjectVersion,
} from './project-persistence-schema'

export function createStoredProject(
  project: LiftPlanProject,
  configurationDraft: unknown = project.configuration,
): StoredLiftPlanProject {
  const serializedPlanningData = JSON.stringify(configurationDraft)
  if (serializedPlanningData === undefined) {
    throw new Error('Planungsdaten sind nicht als JSON serialisierbar.')
  }
  return {
    id: project.id,
    schemaVersion: LIFTPLAN_STORAGE_SCHEMA_VERSION,
    name: project.name,
    liftFamily: project.liftFamily,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    projectVersion: project.projectVersion,
    planningData: JSON.parse(serializedPlanningData) as JsonValue,
  }
}

export interface LoadedProjectState {
  readonly project: LiftPlanProject
  readonly configurationDraft: unknown
}

export function createLoadedProjectState(record: StoredLiftPlanProject): LoadedProjectState {
  const validation = validateLiftConfiguration(record.planningData)
  const fallback = createLiftPlanProject({
    projectId: record.id,
    projectName: record.name,
    liftFamily: record.liftFamily,
    createdAt: record.createdAt,
  }, { now: () => record.updatedAt, createId: () => record.id })
  const configuration = validation.status === 'valid' && validation.configuration
    ? validation.configuration
    : fallback.configuration
  return {
    project: {
      ...fallback,
      name: record.name,
      liftFamily: configuration.family,
      configuration,
      updatedAt: record.updatedAt,
      projectVersion: record.projectVersion,
    },
    configurationDraft: structuredClone(record.planningData),
  }
}

function planningDataWithName(planningData: JsonValue, name: string): JsonValue {
  if (!planningData || Array.isArray(planningData) || typeof planningData !== 'object') return planningData
  if (planningData.family !== 'passenger' && planningData.family !== 'goods' && planningData.family !== 'car') return planningData
  return { ...planningData, projectName: name }
}

export function renameStoredProject(
  project: StoredLiftPlanProject,
  name: string,
  updatedAt: string,
): StoredLiftPlanProject {
  return {
    ...project,
    name,
    updatedAt,
    planningData: planningDataWithName(project.planningData, name),
  }
}

export function duplicateStoredProject(
  project: StoredLiftPlanProject,
  input: { readonly id: string; readonly name: string; readonly timestamp: string },
): StoredLiftPlanProject {
  return {
    ...project,
    id: input.id,
    name: input.name,
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
    projectVersion: 0,
    planningData: planningDataWithName(structuredClone(project.planningData), input.name),
  }
}

export async function saveProjectVersion(
  repository: ProjectRepository,
  project: StoredLiftPlanProject,
  timestamp: string,
  note?: string,
): Promise<{ readonly project: StoredLiftPlanProject; readonly version: StoredLiftPlanProjectVersion }> {
  const history = await repository.listVersions(project.id)
  const nextVersion = Math.max(project.projectVersion, ...history.map((entry) => entry.version), 0) + 1
  const nextProject = { ...project, projectVersion: nextVersion, updatedAt: timestamp }
  const version: StoredLiftPlanProjectVersion = {
    projectId: project.id,
    version: nextVersion,
    createdAt: timestamp,
    note: note?.trim() || undefined,
    snapshot: structuredClone(nextProject),
  }
  await repository.saveProjectVersion(nextProject, version)
  return { project: nextProject, version }
}

export async function restoreProjectVersion(
  repository: ProjectRepository,
  current: StoredLiftPlanProject,
  version: StoredLiftPlanProjectVersion,
  timestamp: string,
): Promise<StoredLiftPlanProject> {
  const restored = {
    ...version.snapshot,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: timestamp,
    projectVersion: current.projectVersion,
  }
  await repository.saveProject(restored)
  return restored
}
