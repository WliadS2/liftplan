import type { ProjectRepository } from './project-repository'
import type {
  StoredLiftPlanProject,
  StoredLiftPlanProjectVersion,
} from './project-persistence-schema'
import { migrateStoredProject } from './project-persistence-schema'

const DATABASE_NAME = 'liftplan-projects'
const DATABASE_VERSION = 1
const PROJECT_STORE = 'projects'
const VERSION_STORE = 'versions'

interface IndexedVersionRecord extends StoredLiftPlanProjectVersion {
  readonly key: string
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB-Anfrage fehlgeschlagen.'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB-Transaktion fehlgeschlagen.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB-Transaktion wurde abgebrochen.'))
  })
}

function versionKey(projectId: string, version: number) {
  return `${projectId}:${String(version).padStart(10, '0')}`
}

export class IndexedDbProjectRepository implements ProjectRepository {
  private databasePromise?: Promise<IDBDatabase>
  private readonly indexedDb: IDBFactory

  constructor(indexedDb: IDBFactory = globalThis.indexedDB) {
    this.indexedDb = indexedDb
  }

  private database(): Promise<IDBDatabase> {
    if (!this.indexedDb) return Promise.reject(new Error('IndexedDB ist in diesem Browser nicht verfügbar.'))
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = this.indexedDb.open(DATABASE_NAME, DATABASE_VERSION)
        request.onupgradeneeded = () => {
          const database = request.result
          if (!database.objectStoreNames.contains(PROJECT_STORE)) {
            database.createObjectStore(PROJECT_STORE, { keyPath: 'id' })
          }
          if (!database.objectStoreNames.contains(VERSION_STORE)) {
            const store = database.createObjectStore(VERSION_STORE, { keyPath: 'key' })
            store.createIndex('projectId', 'projectId', { unique: false })
          }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('LiftPlan-Datenbank konnte nicht geöffnet werden.'))
      })
    }
    return this.databasePromise
  }

  async listProjects() {
    const database = await this.database()
    const values = await requestResult(database.transaction(PROJECT_STORE).objectStore(PROJECT_STORE).getAll())
    return values.map((value) => {
      const parsed = migrateStoredProject(value)
      if (!parsed.ok) throw new Error(parsed.error.message)
      return parsed.value
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async getProject(id: string) {
    const database = await this.database()
    const value = await requestResult(database.transaction(PROJECT_STORE).objectStore(PROJECT_STORE).get(id))
    if (value === undefined) return undefined
    const parsed = migrateStoredProject(value)
    if (!parsed.ok) throw new Error(parsed.error.message)
    return parsed.value
  }

  async saveProject(project: StoredLiftPlanProject) {
    const database = await this.database()
    const transaction = database.transaction(PROJECT_STORE, 'readwrite')
    transaction.objectStore(PROJECT_STORE).put(project)
    await transactionDone(transaction)
  }

  async deleteProject(id: string) {
    const database = await this.database()
    const transaction = database.transaction([PROJECT_STORE, VERSION_STORE], 'readwrite')
    transaction.objectStore(PROJECT_STORE).delete(id)
    const versionStore = transaction.objectStore(VERSION_STORE)
    const keys = await requestResult(versionStore.index('projectId').getAllKeys(id))
    keys.forEach((key) => versionStore.delete(key))
    await transactionDone(transaction)
  }

  async listVersions(projectId: string) {
    const database = await this.database()
    const records = await requestResult(
      database.transaction(VERSION_STORE).objectStore(VERSION_STORE).index('projectId').getAll(projectId),
    ) as IndexedVersionRecord[]
    return records.map((record) => {
      const snapshot = migrateStoredProject(record.snapshot)
      if (!snapshot.ok) throw new Error(snapshot.error.message)
      return {
        projectId: record.projectId,
        version: record.version,
        createdAt: record.createdAt,
        note: record.note,
        snapshot: snapshot.value,
      }
    }).sort((a, b) => b.version - a.version)
  }

  async saveProjectVersion(project: StoredLiftPlanProject, version: StoredLiftPlanProjectVersion) {
    const database = await this.database()
    const transaction = database.transaction([PROJECT_STORE, VERSION_STORE], 'readwrite')
    transaction.objectStore(PROJECT_STORE).put(project)
    transaction.objectStore(VERSION_STORE).put({ ...version, key: versionKey(version.projectId, version.version) })
    await transactionDone(transaction)
  }

  async importProject(project: StoredLiftPlanProject, versions: readonly StoredLiftPlanProjectVersion[]) {
    const database = await this.database()
    const transaction = database.transaction([PROJECT_STORE, VERSION_STORE], 'readwrite')
    transaction.objectStore(PROJECT_STORE).put(project)
    const store = transaction.objectStore(VERSION_STORE)
    const existingKeys = await requestResult(store.index('projectId').getAllKeys(project.id))
    existingKeys.forEach((key) => store.delete(key))
    versions.forEach((version) => store.put({ ...version, key: versionKey(project.id, version.version) }))
    await transactionDone(transaction)
  }
}

let browserRepository: ProjectRepository | undefined

export function getBrowserProjectRepository(): ProjectRepository {
  browserRepository ??= new IndexedDbProjectRepository()
  return browserRepository
}
