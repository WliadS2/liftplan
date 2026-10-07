import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getLiftTypeDefinitions } from '../../elevator'
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
  
  const [versionNote, setVersionNote] = useState('')
  const [renameInput, setRenameInput] = useState('')
  const [status, setStatus] = useState<ProjectSaveStatus>('saved')
  const [message, setMessage] = useState<string>()
  const importRef = useRef<HTMLInputElement>(null)
  
  const openDialogRef = useRef<HTMLDialogElement>(null)
  const renameDialogRef = useRef<HTMLDialogElement>(null)
  const deleteDialogRef = useRef<HTMLDialogElement>(null)

  const liftTypes = useMemo(() => getLiftTypeDefinitions(), [])
  const getLiftFamilyName = useCallback((id: string) => {
    return liftTypes.find((t) => t.id === id)?.displayName || id
  }, [liftTypes])

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
    setMessage(undefined)
  }

  const currentRecord = () => createStoredProject(project, configurationDraft)

  const handleCreate = () => {
    createProject()
    setMessage(undefined)
  }

  const handleOpenClick = () => {
    openDialogRef.current?.showModal()
  }

  const confirmOpen = async (id: string) => {
    const record = await repository.getProject(id)
    if (!record) {
      setMessage('Das ausgewählte Projekt wurde nicht gefunden.')
      return
    }
    loadRecord(record)
    openDialogRef.current?.close()
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

  const handleRenameClick = () => {
    if (persistenceMode !== 'project') return
    setRenameInput(project.name)
    renameDialogRef.current?.showModal()
  }

  const confirmRename = async () => {
    const name = renameInput.trim()
    if (!name) return
    const renamed = renameStoredProject(currentRecord(), name, new Date().toISOString())
    await repository.saveProject(renamed)
    setProjectName(name)
    await refreshProjects()
    renameDialogRef.current?.close()
  }

  const handleDeleteClick = () => {
    if (persistenceMode !== 'project') return
    deleteDialogRef.current?.showModal()
  }

  const confirmDelete = async () => {
    autosave.cancel()
    await repository.deleteProject(project.id)
    createProject()
    await refreshProjects()
    deleteDialogRef.current?.close()
  }

  const handleVersionSave = async (e: React.FormEvent) => {
    e.preventDefault()
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
    setMessage('Projektdatei wurde erfolgreich exportiert.')
  }

  const handleImport = async (file: File) => {
    const parsed = parseLiftPlanProjectFile(await file.text())
    if (!parsed.ok) {
      setMessage(`Import fehlgeschlagen: ${parsed.error.message}${parsed.error.paths.length ? ` (${parsed.error.paths.join(', ')})` : ''}`)
      return
    }
    const history = parsed.value.versions ?? []
    await repository.importProject(parsed.value.project, history)
    loadRecord(parsed.value.project)
    await refreshProjects()
    await refreshVersions(parsed.value.project.id)
    setMessage('Projektdatei wurde erfolgreich importiert.')
  }

  const disabled = persistenceMode !== 'project'

  return (
    <section className="project-persistence" aria-label="Projektverwaltung">
      <div className="project-persistence-actions">
        <button type="button" className="primary-action" onClick={handleCreate}>Neues Projekt</button>
        <button type="button" className="primary-action" disabled={disabled} onClick={() => void autosave.saveNow(currentRecord())}>
          Projekt speichern
        </button>
        <span className="toolbar-divider" />
        <button type="button" onClick={handleOpenClick}>Projekt öffnen…</button>
        <button type="button" disabled={disabled} onClick={() => void handleDuplicate()}>Projekt duplizieren</button>
        <button type="button" disabled={disabled} onClick={handleRenameClick}>Projekt umbenennen…</button>
        <button type="button" disabled={disabled} onClick={handleDeleteClick}>Projekt löschen…</button>
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
        <form className="version-save-form" onSubmit={(e) => void handleVersionSave(e)}>
          <input
            aria-label="Versionsnotiz"
            maxLength={240}
            placeholder="Optionale Versionsnotiz"
            value={versionNote}
            onChange={(event) => setVersionNote(event.target.value)}
          />
          <button type="submit" disabled={disabled}>Version speichern</button>
        </form>
        {versions.length === 0 ? <p className="versions-empty">Keine gespeicherten Versionen.</p> : (
          <div className="version-history-list">
            {versions.map((version) => (
              <div key={version.version} className="version-item">
                <div className="version-info">
                  <strong>v{version.version}</strong>
                  <span className="version-date">{new Date(version.createdAt).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  {version.note && <span className="version-note">{version.note}</span>}
                </div>
                <button type="button" className="restore-action" onClick={() => void handleRestore(version)}>Wiederherstellen</button>
              </div>
            ))}
          </div>
        )}
      </details>
      {(message || disabled) && <p className={`project-persistence-message ${message?.includes('fehlgeschlagen') ? 'error' : 'success'}`} role="status">
        {disabled ? 'Entwicklungsdemo wird nicht gespeichert.' : message}
      </p>}

      {/* Dialogs */}
      <dialog ref={openDialogRef} className="liftplan-dialog open-project-dialog">
        <div className="dialog-content">
          <div className="dialog-header">
            <h3 className="dialog-title">Projekt öffnen</h3>
            <button type="button" aria-label="Schließen" className="close-button" onClick={() => openDialogRef.current?.close()}>&times;</button>
          </div>
          {projects.length === 0 ? (
            <p className="dialog-empty">Keine gespeicherten Projekte vorhanden.</p>
          ) : (
            <ul className="project-list">
              {projects.map((entry) => (
                <li key={entry.id} className={`project-list-item ${entry.id === project.id ? 'active' : ''}`}>
                  <button type="button" onClick={() => void confirmOpen(entry.id)}>
                    <span className="project-name">{entry.name}</span>
                    <span className="project-meta">
                      {getLiftFamilyName(entry.liftFamily)} · {new Date(entry.updatedAt).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </dialog>

      <dialog ref={renameDialogRef} className="liftplan-dialog" onClose={() => setRenameInput('')}>
        <form method="dialog" onSubmit={(e) => { e.preventDefault(); void confirmRename(); }}>
          <div className="dialog-content">
            <h3 className="dialog-title">Projekt umbenennen</h3>
            <label className="field">
              <span>Neuer Projektname</span>
              <input autoFocus value={renameInput} onChange={(e) => setRenameInput(e.target.value)} />
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={() => renameDialogRef.current?.close()}>Abbrechen</button>
              <button type="submit" className="primary-action">Umbenennen</button>
            </div>
          </div>
        </form>
      </dialog>

      <dialog ref={deleteDialogRef} className="liftplan-dialog">
        <div className="dialog-content">
          <h3 className="dialog-title">Projekt löschen</h3>
          <p>Möchten Sie das Projekt „{project.name}“ wirklich unwiderruflich löschen?</p>
          <div className="dialog-actions">
            <button type="button" onClick={() => deleteDialogRef.current?.close()}>Abbrechen</button>
            <button type="button" className="danger-action" onClick={() => void confirmDelete()}>Löschen</button>
          </div>
        </div>
      </dialog>
    </section>
  )
}
