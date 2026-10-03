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
  readonly validation: StructuralValidationResult
  createProject: (input?: CreateLiftPlanProjectInput) => void
  setLiftFamily: (family: RegisteredLiftFamily) => void
  updateConfiguration: (configuration: unknown) => StructuralValidationResult
  setProjectName: (projectName: string) => void
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
    validation: {
      status: 'valid',
      issues: [],
    },
    createProject: (input = {}) => {
      set({
        project: createLiftPlanProject(input, options),
        validation: { status: 'valid', issues: [] },
      })
    },
    setLiftFamily: (family) => {
      set({
        project: createProjectForLiftFamily(get().project, family, options),
        validation: { status: 'valid', issues: [] },
      })
    },
    updateConfiguration: (configuration) => {
      const result = replaceProjectConfiguration(
        get().project,
        configuration,
        now(),
      )

      set({ project: result.project, validation: result.validation })
      return result.validation
    },
    setProjectName: (projectName) => {
      set({ project: updateProjectName(get().project, projectName, now()) })
    },
    resetProject: () => {
      set({
        project: createLiftPlanProject({}, options),
        validation: { status: 'valid', issues: [] },
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
