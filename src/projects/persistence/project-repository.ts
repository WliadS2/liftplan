import type {
  StoredLiftPlanProject,
  StoredLiftPlanProjectVersion,
} from './project-persistence-schema'

export interface ProjectRepository {
  listProjects(): Promise<readonly StoredLiftPlanProject[]>
  getProject(id: string): Promise<StoredLiftPlanProject | undefined>
  saveProject(project: StoredLiftPlanProject): Promise<void>
  deleteProject(id: string): Promise<void>
  listVersions(projectId: string): Promise<readonly StoredLiftPlanProjectVersion[]>
  saveProjectVersion(
    project: StoredLiftPlanProject,
    version: StoredLiftPlanProjectVersion,
  ): Promise<void>
  importProject(
    project: StoredLiftPlanProject,
    versions: readonly StoredLiftPlanProjectVersion[],
  ): Promise<void>
}

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly projects = new Map<string, StoredLiftPlanProject>()
  private readonly versions = new Map<string, StoredLiftPlanProjectVersion[]>()

  async listProjects() {
    return [...this.projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async getProject(id: string) {
    return this.projects.get(id)
  }

  async saveProject(project: StoredLiftPlanProject) {
    this.projects.set(project.id, structuredClone(project))
  }

  async deleteProject(id: string) {
    this.projects.delete(id)
    this.versions.delete(id)
  }

  async listVersions(projectId: string) {
    return [...(this.versions.get(projectId) ?? [])].sort((a, b) => b.version - a.version)
  }

  async saveProjectVersion(project: StoredLiftPlanProject, version: StoredLiftPlanProjectVersion) {
    this.projects.set(project.id, structuredClone(project))
    const current = this.versions.get(project.id) ?? []
    this.versions.set(project.id, [
      ...current.filter((entry) => entry.version !== version.version),
      structuredClone(version),
    ])
  }

  async importProject(project: StoredLiftPlanProject, versions: readonly StoredLiftPlanProjectVersion[]) {
    this.projects.set(project.id, structuredClone(project))
    this.versions.set(project.id, structuredClone([...versions]))
  }
}
