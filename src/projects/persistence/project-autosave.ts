import type { ProjectRepository } from './project-repository'
import type { StoredLiftPlanProject } from './project-persistence-schema'

export type ProjectSaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

export const PROJECT_SAVE_STATUS_LABELS: Readonly<Record<ProjectSaveStatus, string>> = {
  saved: 'Gespeichert',
  saving: 'Speichern…',
  unsaved: 'Ungespeicherte Änderungen',
  error: 'Speicherfehler',
}

export class ProjectAutosaveController {
  private timeout: ReturnType<typeof setTimeout> | undefined
  private pending: StoredLiftPlanProject | undefined
  private generation = 0
  private readonly repository: ProjectRepository
  private readonly onStatus: (status: ProjectSaveStatus) => void
  private readonly onSaved?: () => void
  private readonly debounceMs: number

  constructor(
    repository: ProjectRepository,
    onStatus: (status: ProjectSaveStatus) => void,
    onSaved?: () => void,
    debounceMs = 1000,
  ) {
    this.repository = repository
    this.onStatus = onStatus
    this.onSaved = onSaved
    this.debounceMs = debounceMs
  }

  schedule(project: StoredLiftPlanProject) {
    this.pending = project
    this.generation += 1
    const generation = this.generation
    if (this.timeout) clearTimeout(this.timeout)
    this.onStatus('unsaved')
    this.timeout = setTimeout(() => void this.persist(generation), this.debounceMs)
  }

  async saveNow(project?: StoredLiftPlanProject) {
    if (project) this.pending = project
    this.generation += 1
    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = undefined
    await this.persist(this.generation)
  }

  cancel() {
    this.generation += 1
    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = undefined
    this.pending = undefined
  }

  private async persist(generation: number) {
    const project = this.pending
    if (!project) return
    this.onStatus('saving')
    try {
      await this.repository.saveProject(project)
      if (generation !== this.generation) return
      this.pending = undefined
      this.onStatus('saved')
      this.onSaved?.()
    } catch {
      if (generation === this.generation) this.onStatus('error')
    }
  }
}
