import { z } from 'zod'
import { registeredLiftFamilySchema } from '../../elevator'

export const LIFTPLAN_STORAGE_SCHEMA_VERSION = 1 as const
export const LIFTPLAN_PROJECT_FILE_FORMAT = 'liftplan-project-file' as const

export type JsonValue = null | boolean | number | string | JsonValue[] | {
  readonly [key: string]: JsonValue
}

function isJsonValue(value: unknown, seen = new Set<object>()): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)
  const valid = Array.isArray(value)
    ? value.every((entry) => isJsonValue(entry, seen))
    : Object.values(value).every((entry) => isJsonValue(entry, seen))
  seen.delete(value)
  return valid
}

const jsonValueSchema = z.unknown().refine(isJsonValue, {
  message: 'planningData must be finite JSON data',
})

export const storedProjectSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(LIFTPLAN_STORAGE_SCHEMA_VERSION),
  name: z.string(),
  liftFamily: registeredLiftFamilySchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  projectVersion: z.number().int().nonnegative(),
  planningData: jsonValueSchema,
}).strict().superRefine((record, context) => {
  const planningData = record.planningData
  if (!planningData || Array.isArray(planningData) || typeof planningData !== 'object') return
  if (typeof planningData.family === 'string' && planningData.family !== record.liftFamily) {
    context.addIssue({
      code: 'custom',
      message: 'planningData family does not match liftFamily',
      path: ['planningData', 'family'],
    })
  }
})

export type StoredLiftPlanProject = z.infer<typeof storedProjectSchema> & {
  readonly planningData: JsonValue
}

export const storedProjectVersionSchema = z.object({
  projectId: z.string().min(1),
  version: z.number().int().positive(),
  createdAt: z.string().min(1),
  note: z.string().max(240).optional(),
  snapshot: storedProjectSchema,
}).strict()

export type StoredLiftPlanProjectVersion = z.infer<typeof storedProjectVersionSchema> & {
  readonly snapshot: StoredLiftPlanProject
}

export const liftPlanProjectFileSchema = z.object({
  format: z.literal(LIFTPLAN_PROJECT_FILE_FORMAT),
  schemaVersion: z.literal(LIFTPLAN_STORAGE_SCHEMA_VERSION),
  exportedAt: z.string().min(1),
  project: storedProjectSchema,
  versions: z.array(storedProjectVersionSchema).optional(),
}).strict()

export interface LiftPlanProjectFile {
  readonly format: typeof LIFTPLAN_PROJECT_FILE_FORMAT
  readonly schemaVersion: typeof LIFTPLAN_STORAGE_SCHEMA_VERSION
  readonly exportedAt: string
  readonly project: StoredLiftPlanProject
  readonly versions?: readonly StoredLiftPlanProjectVersion[]
}

export interface PersistenceParseError {
  readonly code: 'invalid-json' | 'invalid-format' | 'unsupported-schema'
  readonly message: string
  readonly paths: readonly string[]
}

export type PersistenceParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PersistenceParseError }

function pathStrings(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.path.join('.') || '(Dokument)')
}

/** Explicit migration boundary. Future versions are added one step at a time here. */
export function migrateStoredProject(input: unknown): PersistenceParseResult<StoredLiftPlanProject> {
  const identity = z.object({ schemaVersion: z.number().int() }).safeParse(input)
  if (!identity.success) {
    return {
      ok: false,
      error: {
        code: 'invalid-format',
        message: 'Das Projekt enthält keine gültige Schema-Version.',
        paths: pathStrings(identity.error),
      },
    }
  }
  if (identity.data.schemaVersion !== LIFTPLAN_STORAGE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: {
        code: 'unsupported-schema',
        message: `Die Projektversion ${identity.data.schemaVersion} wird nicht unterstützt.`,
        paths: ['schemaVersion'],
      },
    }
  }
  const parsed = storedProjectSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'invalid-format',
        message: 'Die Projektdatei enthält ungültige oder unbekannte Felder.',
        paths: pathStrings(parsed.error),
      },
    }
  }
  return { ok: true, value: parsed.data as StoredLiftPlanProject }
}

export function parseLiftPlanProjectFile(source: string): PersistenceParseResult<LiftPlanProjectFile> {
  let input: unknown
  try {
    input = JSON.parse(source)
  } catch {
    return {
      ok: false,
      error: { code: 'invalid-json', message: 'Die Datei enthält kein gültiges JSON.', paths: [] },
    }
  }
  const identity = z.object({
    format: z.string(),
    schemaVersion: z.number().int(),
  }).safeParse(input)
  if (!identity.success || identity.data.format !== LIFTPLAN_PROJECT_FILE_FORMAT) {
    return {
      ok: false,
      error: {
        code: 'invalid-format',
        message: 'Die Datei ist kein gültiges LiftPlan-Projekt.',
        paths: identity.success ? ['format'] : pathStrings(identity.error),
      },
    }
  }
  if (identity.data.schemaVersion !== LIFTPLAN_STORAGE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: {
        code: 'unsupported-schema',
        message: `Die Dateiversion ${identity.data.schemaVersion} wird nicht unterstützt.`,
        paths: ['schemaVersion'],
      },
    }
  }
  const parsed = liftPlanProjectFileSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'invalid-format',
        message: 'Die LiftPlan-Datei enthält ungültige oder unbekannte Daten.',
        paths: pathStrings(parsed.error),
      },
    }
  }
  const mismatchedVersion = parsed.data.versions?.find((version) =>
    version.projectId !== parsed.data.project.id ||
    version.snapshot.id !== parsed.data.project.id ||
    version.snapshot.projectVersion !== version.version,
  )
  if (mismatchedVersion) {
    return {
      ok: false,
      error: {
        code: 'invalid-format',
        message: 'Der Versionsverlauf gehört nicht zum importierten Projekt.',
        paths: ['versions'],
      },
    }
  }
  return { ok: true, value: parsed.data as LiftPlanProjectFile }
}

export function serializeLiftPlanProjectFile(
  project: StoredLiftPlanProject,
  exportedAt: string,
  versions?: readonly StoredLiftPlanProjectVersion[],
): string {
  const file: LiftPlanProjectFile = {
    format: LIFTPLAN_PROJECT_FILE_FORMAT,
    schemaVersion: LIFTPLAN_STORAGE_SCHEMA_VERSION,
    exportedAt,
    project,
    versions: versions?.length ? versions : undefined,
  }
  return JSON.stringify(file, null, 2)
}
