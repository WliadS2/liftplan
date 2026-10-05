import { create } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { StateCreator } from 'zustand'
import type {
  RegisteredLiftFamily,
  StructuralValidationResult,
} from '../elevator'
import {
  createLiftPlanProject,
  createProjectForLiftFamily,
  type ProjectFactoryDependencies,
} from './project-factory'
import {
  replaceProjectConfiguration,
  updateProjectName,
} from './project-configuration'
import type { CreateLiftPlanProjectInput, LiftPlanProject } from './models/liftplan-project'

export interface ProjectStoreState {
  readonly project: LiftPlanProject
  readonly configurationDraft: unknown
  readonly validation: StructuralValidationResult
  readonly persistenceMode: 'project' | 'development-demo'
  createProject: (input?: CreateLiftPlanProjectInput) => void
  setLiftFamily: (family: RegisteredLiftFamily) => void
  updateConfiguration: (configuration: unknown) => StructuralValidationResult
  setProjectName: (projectName: string) => void
  loadProject: (project: LiftPlanProject, configurationDraft?: unknown) => void
  setProjectVersion: (projectVersion: number) => void
  loadDevelopmentConfiguration: (configuration: unknown) => StructuralValidationResult
  resetProject: () => void
}

export type ProjectStoreOptions = ProjectFactoryDependencies

function createProjectStoreState(
  options: ProjectStoreOptions = {},
): StateCreator<ProjectStoreState> {
  const now = options.now ?? (() => new Date().toISOString())
  const initialProject = createLiftPlanProject({}, options)

  return (set, get) => ({
    project: initialProject,
    configurationDraft: initialProject.configuration,
    validation: {
      status: 'valid',
      issues: [],
    },
    persistenceMode: 'project',
    createProject: (input = {}) => {
      const project = createLiftPlanProject(input, options)
      set({
        project,
        configurationDraft: project.configuration,
        validation: { status: 'valid', issues: [] },
        persistenceMode: 'project',
      })
    },
    setLiftFamily: (family) => {
      const project = createProjectForLiftFamily(get().project, family, options)
      set({
        project,
        configurationDraft: project.configuration,
        validation: { status: 'valid', issues: [] },
        persistenceMode: 'project',
      })
    },
    updateConfiguration: (configuration) => {
      const result = replaceProjectConfiguration(
        get().project,
        configuration,
        now(),
      )

      const project = result.validation.status === 'invalid'
        ? { ...result.project, updatedAt: now() }
        : result.project
      set({
        project,
        configurationDraft: configuration,
        validation: result.validation,
      })
      return result.validation
    },
    setProjectName: (projectName) => {
      const project = updateProjectName(get().project, projectName, now())
      set({ project, configurationDraft: project.configuration })
    },
    loadProject: (project, configurationDraft = project.configuration) => {
      const validation = replaceProjectConfiguration(
        project,
        configurationDraft,
        project.updatedAt,
      ).validation
      set({
        project,
        configurationDraft,
        validation,
        persistenceMode: 'project',
      })
    },
    setProjectVersion: (projectVersion) => {
      set({ project: { ...get().project, projectVersion } })
    },
    loadDevelopmentConfiguration: (configuration) => {
      const result = replaceProjectConfiguration(get().project, configuration, now())
      set({
        project: result.project,
        configurationDraft: configuration,
        validation: result.validation,
        persistenceMode: 'development-demo',
      })
      return result.validation
    },
    resetProject: () => {
      const project = createLiftPlanProject({}, options)
      set({
        project,
        configurationDraft: project.configuration,
        validation: { status: 'valid', issues: [] },
        persistenceMode: 'project',
      })
    },
  })
}

export function createProjectStore(options: ProjectStoreOptions = {}) {
  return createStore<ProjectStoreState>()(createProjectStoreState(options))
}

export const useProjectStore = create<ProjectStoreState>()(
  createProjectStoreState(),
)
