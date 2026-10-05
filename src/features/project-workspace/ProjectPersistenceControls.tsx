import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PROJECT_SAVE_STATUS_LABELS,
  ProjectAutosaveController,
  createLoadedProjectState,
  createStoredProject,
  duplicateStoredProject,
  getBrowserProjectRepository,
  parseLiftPlanProjectFile,
  renameStoredProject,
  restoreProjectVersion,
  saveProjectVersion,
  serializeLiftPlanProjectFile,
  useProjectStore,
  type ProjectSaveStatus,
  type StoredLiftPlanProject,
  type StoredLiftPlanProjectVersion,
} from '../../projects'

function downloadProjectFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function safeFilename(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Projekt'
}

export function ProjectPersistenceControls() {
  const repository = useMemo(() => getBrowserProjectRepository(), [])
  const project = useProjectStore((state) => state.project)
  const configurationDraft = useProjectStore((state) => state.configurationDraft)
  const persistenceMode = useProjectStore((state) => state.persistenceMode)
  const createProject = useProjectStore((state) => state.createProject)
  const loadProject = useProjectStore((state) => state.loadProject)
  const setProjectName = useProjectStore((state) => state.setProjectName)
  const setProjectVersion = useProjectStore((state) => state.setProjectVersion)
  const [projects, setProjects] = useState<readonly StoredLiftPlanProject[]>([])
  const [versions, setVersions] = useState<readonly StoredLiftPlanProjectVersion[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState(project.id)
  const [versionNote, setVersionNote] = useState('')
  const [status, setStatus] = useState<ProjectSaveStatus>('saved')
  const [message, setMessage] = useState<string>()
  const importRef = useRef<HTMLInputElement>(null)

  const refreshProjects = useCallback(async () => {
    setProjects(await repository.listProjects())
  }, [repository])
  const refreshVersions = useCallback(async (projectId: string) => {
    setVersions(await repository.listVersions(projectId))
  }, [repository])
  const autosave = useMemo(() => new ProjectAutosaveController(
    repository,
    setStatus,
    () => void refreshProjects(),
  ), [refreshProjects, repository])

  useEffect(() => {
    let active = true
    repository.listProjects().then(
      (entries) => { if (active) setProjects(entries) },
      () => { if (active) setStatus('error') },
    )
    return () => {
      active = false
      autosave.cancel()
    }
  }, [autosave, repository])

  useEffect(() => {
    if (persistenceMode === 'development-demo') {
      autosave.cancel()
      return
    }
    autosave.schedule(createStoredProject(project, configurationDraft))
  }, [autosave, configurationDraft, persistenceMode, project])

  useEffect(() => {
    let active = true
    if (persistenceMode === 'project') {
      repository.listVersions(project.id).then((entries) => {
        if (active) setVersions(entries)
      })
    }
    return () => { active = false }
  }, [persistenceMode, project.id, repository])

  const loadRecord = (record: StoredLiftPlanProject) => {
    autosave.cancel()
    const loaded = createLoadedProjectState(record)
    loadProject(loaded.project, loaded.configurationDraft)
    setSelectedProjectId(record.id)
    setMessage(undefined)
  }

  const currentRecord = () => createStoredProject(project, configurationDraft)

  const handleCreate = () => {
    createProject()
    setSelectedProjectId(useProjectStore.getState().project.id)
    setMessage(undefined)
  }

  const handleOpen = async () => {
    const effectiveProjectId = projects.some((entry) => entry.id === selectedProjectId)
      ? selectedProjectId
      : project.id
    const record = await repository.getProject(effectiveProjectId)
    if (!record) {
      setMessage('Das ausgewählte Projekt wurde nicht gefunden.')
      return
    }
    loadRecord(record)
  }

  const handleDuplicate = async () => {
    if (persistenceMode !== 'project') return
    const timestamp = new Date().toISOString()
    const duplicate = duplicateStoredProject(currentRecord(), {
      id: crypto.randomUUID(),
      name: `${project.name} – Kopie`,
      timestamp,
    })
    await repository.saveProject(duplicate)
    loadRecord(duplicate)
    await refreshProjects()
  }

  const handleRename = async () => {
    if (persistenceMode !== 'project') return
    const name = window.prompt('Neuer Projektname', project.name)?.trim()
    if (!name) return
    const renamed = renameStoredProject(currentRecord(), name, new Date().toISOString())
    await repository.saveProject(renamed)
    setProjectName(name)
    await refreshProjects()
  }

  const handleDelete = async () => {
    if (persistenceMode !== 'project') return
    if (!window.confirm(`Projekt „${project.name}“ wirklich löschen?`)) return
    autosave.cancel()
    await repository.deleteProject(project.id)
    createProject()
    setSelectedProjectId(useProjectStore.getState().project.id)
    await refreshProjects()
  }

  const handleVersionSave = async () => {
    if (persistenceMode !== 'project') return
    const result = await saveProjectVersion(
      repository,
      currentRecord(),
      new Date().toISOString(),
      versionNote,
    )
    setProjectVersion(result.project.projectVersion)
    setVersionNote('')
    await refreshVersions(project.id)
    await refreshProjects()
  }

  const handleRestore = async (version: StoredLiftPlanProjectVersion) => {
    const restored = await restoreProjectVersion(
      repository,
      currentRecord(),
      version,
      new Date().toISOString(),
    )
    loadRecord(restored)
    await refreshVersions(restored.id)
  }

  const handleExport = async () => {
    if (persistenceMode !== 'project') return
    const history = await repository.listVersions(project.id)
    const content = serializeLiftPlanProjectFile(currentRecord(), new Date().toISOString(), history)
    downloadProjectFile(content, `LiftPlan_${safeFilename(project.name)}.liftplan.json`)
  }

  const handleImport = async (file: File) => {
    const parsed = parseLiftPlanProjectFile(await file.text())
    if (!parsed.ok) {
      setMessage(`${parsed.error.message}${parsed.error.paths.length ? ` (${parsed.error.paths.join(', ')})` : ''}`)
      return
    }
    const history = parsed.value.versions ?? []
    await repository.importProject(parsed.value.project, history)
    loadRecord(parsed.value.project)
    await refreshProjects()
    await refreshVersions(parsed.value.project.id)
    setMessage('Projektdatei wurde importiert.')
  }

  const disabled = persistenceMode !== 'project'

  return (
    <section className="project-persistence" aria-label="Projektverwaltung">
      <div className="project-persistence-actions">
        <button type="button" className="primary-action" onClick={handleCreate}>Neues Projekt</button>
        <button type="button" className="primary-action" disabled={disabled} onClick={() => void autosave.saveNow(currentRecord())}>
          Projekt speichern
        </button>
        <select
          aria-label="Gespeichertes Projekt"
          value={selectedProjectId}
          onChange={(event) => setSelectedProjectId(event.target.value)}
        >
          {!projects.some((entry) => entry.id === selectedProjectId) && <option value={selectedProjectId}>{project.name}</option>}
          {projects.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
        <button type="button" onClick={() => void handleOpen()}>Projekt öffnen</button>
        <button type="button" disabled={disabled} onClick={() => void handleDuplicate()}>Projekt duplizieren</button>
        <button type="button" disabled={disabled} onClick={() => void handleRename()}>Projekt umbenennen</button>
        <button type="button" disabled={disabled} onClick={() => void handleDelete()}>Projekt löschen</button>
      </div>
      <div className="project-persistence-actions secondary-project-actions">
        <button type="button" disabled={disabled} onClick={() => void handleExport()}>Projektdatei exportieren</button>
        <button type="button" onClick={() => importRef.current?.click()}>Projektdatei importieren</button>
        <input
          ref={importRef}
          className="visually-hidden"
          type="file"
          accept=".json,.liftplan.json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleImport(file)
            event.currentTarget.value = ''
          }}
        />
        <span className={`save-status save-status-${status}`}>{PROJECT_SAVE_STATUS_LABELS[status]}</span>
      </div>
      <details className="project-versions">
        <summary>Versionsverlauf ({versions.length})</summary>
        <div className="version-save-row">
          <input
            aria-label="Versionsnotiz"
            maxLength={240}
            placeholder="Optionale Versionsnotiz"
            value={versionNote}
            onChange={(event) => setVersionNote(event.target.value)}
          />
          <button type="button" disabled={disabled} onClick={() => void handleVersionSave()}>Version speichern</button>
        </div>
        {versions.length === 0 ? <p>Keine gespeicherten Versionen.</p> : (
          <ul>
            {versions.map((version) => (
              <li key={version.version}>
                <span>Version {version.version} · {new Date(version.createdAt).toLocaleString('de-CH')}{version.note ? ` · ${version.note}` : ''}</span>
                <button type="button" onClick={() => void handleRestore(version)}>Wiederherstellen</button>
              </li>
            ))}
          </ul>
        )}
      </details>
      {(message || disabled) && <p className="project-persistence-message" role="status">
        {disabled ? 'Entwicklungsdemo wird nicht gespeichert.' : message}
      </p>}
    </section>
  )
}
