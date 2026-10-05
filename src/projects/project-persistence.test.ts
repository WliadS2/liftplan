// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPassengerMechanicalFixture } from '../dev/fixtures/passenger-mechanical-fixture'
import { loadDevelopmentMechanicalFixture } from '../dev/development-mechanical-session'
import type { RegisteredLiftConfiguration } from '../elevator'
import { createPassengerDrawingContext, createPassengerPlanDrawing } from '../drawings/passenger-technical-drawings'
import { createTechnicalPlanDxfMetadata, prepareTechnicalPlanDxf } from '../documents/technical-plan-dxf'
import { generateTechnicalPlanDxf } from '../documents/technical-plan-dxf-renderer'
import { createLiftGeometryPlanningInput } from '../three/geometry/lift-geometry-planning-input'
import {
  InMemoryProjectRepository,
  ProjectAutosaveController,
  createLiftPlanProject,
  createLoadedProjectState,
  createProjectStore,
  createStoredProject,
  duplicateStoredProject,
  migrateStoredProject,
  parseLiftPlanProjectFile,
  renameStoredProject,
  restoreProjectVersion,
  saveProjectVersion,
  serializeLiftPlanProjectFile,
} from './index'

const t0 = '2026-10-05T10:00:00.000Z'
const t1 = '2026-10-05T11:00:00.000Z'
const t2 = '2026-10-05T12:00:00.000Z'

function fixtureProject() {
  const store = createProjectStore({ createId: () => 'project-1', now: () => t0 })
  store.getState().updateConfiguration(createPassengerMechanicalFixture())
  return store
}

afterEach(() => vi.useRealTimers())

describe('local project persistence', () => {
  it('creates, saves and loads the complete editable planning configuration', async () => {
    const repository = new InMemoryProjectRepository()
    const store = fixtureProject()
    const record = createStoredProject(store.getState().project, store.getState().configurationDraft)
    await repository.saveProject(record)

    const stored = await repository.getProject('project-1')
    expect(stored?.planningData).toEqual(JSON.parse(JSON.stringify(createPassengerMechanicalFixture())))
    const loaded = createLoadedProjectState(stored!)
    expect(loaded.project.configuration).toEqual(store.getState().project.configuration)
    expect(loaded.project.projectVersion).toBe(0)
  })

  it('debounces autosave and retains structurally invalid temporary planning data', async () => {
    vi.useFakeTimers()
    const repository = new InMemoryProjectRepository()
    const statuses: string[] = []
    const controller = new ProjectAutosaveController(repository, (status) => statuses.push(status), undefined, 1000)
    const store = createProjectStore({ createId: () => 'invalid-project', now: () => t0 })
    const invalidDraft = { family: 'passenger', schemaVersion: 'temporarily-invalid', projectName: 'Entwurf' }
    expect(store.getState().updateConfiguration(invalidDraft).status).toBe('invalid')
    controller.schedule(createStoredProject(store.getState().project, store.getState().configurationDraft))

    await vi.advanceTimersByTimeAsync(999)
    expect(await repository.getProject('invalid-project')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect((await repository.getProject('invalid-project'))?.planningData).toEqual(invalidDraft)
    expect(statuses).toEqual(['unsaved', 'saving', 'saved'])
  })

  it('duplicates, renames and deletes projects without sharing history', async () => {
    const repository = new InMemoryProjectRepository()
    const source = createStoredProject(fixtureProject().getState().project)
    await repository.saveProject(source)
    const duplicate = duplicateStoredProject(source, { id: 'copy', name: 'Kopie', timestamp: t1 })
    await repository.saveProject(duplicate)
    const renamed = renameStoredProject(duplicate, 'Umbenannt', t2)
    await repository.saveProject(renamed)

    expect((await repository.getProject('copy'))?.name).toBe('Umbenannt')
    expect((await repository.getProject('copy'))?.planningData).toMatchObject({ projectName: 'Umbenannt' })
    expect((await repository.getProject('project-1'))?.name).toBe('Mechanische Demo – Testdaten')
    expect(await repository.listVersions('copy')).toEqual([])
    await repository.deleteProject('copy')
    expect(await repository.getProject('copy')).toBeUndefined()
  })

  it('saves sequential snapshots and restores an older version without deleting newer history', async () => {
    const repository = new InMemoryProjectRepository()
    const original = createStoredProject(fixtureProject().getState().project)
    const first = await saveProjectVersion(repository, original, t0, 'Ausgangslage')
    const modified = renameStoredProject(first.project, 'Geändert', t1)
    const second = await saveProjectVersion(repository, modified, t1)
    const restored = await restoreProjectVersion(repository, second.project, first.version, t2)

    expect(restored.name).toBe(original.name)
    expect(restored.projectVersion).toBe(2)
    expect((await repository.listVersions(original.id)).map((entry) => entry.version)).toEqual([2, 1])
  })

  it('round-trips .liftplan.json and rejects malformed, unknown or unsupported input', () => {
    const record = createStoredProject(fixtureProject().getState().project)
    const source = serializeLiftPlanProjectFile(record, t1)
    expect(parseLiftPlanProjectFile(source)).toEqual({
      ok: true,
      value: expect.objectContaining({ project: record }),
    })
    expect(parseLiftPlanProjectFile('{broken').ok).toBe(false)
    expect(parseLiftPlanProjectFile(JSON.stringify({
      format: 'liftplan-project-file', schemaVersion: 99, exportedAt: t1, project: record,
    }))).toMatchObject({ ok: false, error: { code: 'unsupported-schema' } })
    expect(migrateStoredProject({ ...record, unknownField: true })).toMatchObject({
      ok: false,
      error: { code: 'invalid-format' },
    })
  })

  it('keeps the Mechanical Demo explicitly isolated from normal project defaults and persistence mode', () => {
    const store = createProjectStore({ createId: () => 'normal', now: () => t0 })
    expect(store.getState().project.configuration).not.toHaveProperty('mechanical')
    expect(store.getState().persistenceMode).toBe('project')
    loadDevelopmentMechanicalFixture(store.getState())
    expect(store.getState().persistenceMode).toBe('development-demo')
    store.getState().createProject({ projectId: 'next' })
    expect(store.getState().persistenceMode).toBe('project')
    expect(store.getState().project.configuration).not.toHaveProperty('mechanical')
  })

  it('recreates identical normalized drawing and DXF coordinates after save/load', async () => {
    const repository = new InMemoryProjectRepository()
    const store = fixtureProject()
    const record = createStoredProject(store.getState().project)
    await repository.saveProject(record)
    const loaded = createLoadedProjectState((await repository.getProject(record.id))!)

    const output = (configuration: RegisteredLiftConfiguration) => {
      const planning = createLiftGeometryPlanningInput(configuration)
      if (!planning) throw new Error('Expected passenger planning data')
      const context = createPassengerDrawingContext(planning)
      if (!context) throw new Error('Expected drawing context')
      const document = createPassengerPlanDrawing(context, '1:50')
      const candidate = {
        document,
        metadata: createTechnicalPlanDxfMetadata(loaded.project, document, new Date(t0)),
      }
      const prepared = prepareTechnicalPlanDxf({ scope: 'current', projectName: loaded.project.name, candidates: [candidate] })
      if (!prepared.ok) throw new Error(prepared.error.code)
      return { document, dxf: generateTechnicalPlanDxf(prepared.value) }
    }
    const before = output(store.getState().project.configuration)
    const after = output(loaded.project.configuration)
    expect(after.document.primitives).toEqual(before.document.primitives)
    expect(after.dxf).toBe(before.dxf)
  })

  it('does not apply demo planning data to a newly created project', () => {
    const project = createLiftPlanProject({ projectId: 'fresh', createdAt: t0 }, { now: () => t0 })
    expect(project.name).toBe('Neues LiftPlan-Projekt')
    expect(project.configuration).toEqual({
      family: 'passenger',
      schemaVersion: 'passenger-planning-v2',
      projectName: 'Neues LiftPlan-Projekt',
    })
  })
})
