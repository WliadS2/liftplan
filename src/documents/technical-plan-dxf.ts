import type { TechnicalDrawingDocument, TechnicalDrawingView } from '../drawings/technical-drawing'
import type { LiftPlanProject } from '../projects'
import type { PassengerEntranceSide } from '../three/geometry/passenger/passenger-installation-model'
import { sanitizeTechnicalDocumentFilenameSegment } from './technical-document-filename'

export type TechnicalPlanDxfScope = 'current' | 'plan-set'

export interface DoorDrawingDxfSelection {
  readonly landing: number
  readonly side: PassengerEntranceSide
}

export interface TechnicalPlanDxfMetadata {
  readonly productName: 'LiftPlan'
  readonly projectName: string
  readonly projectId: string
  readonly drawingType: string
  readonly version: string
  readonly exportDate: string
  readonly unit: 'mm'
  readonly doorSelection?: {
    readonly landing: number
    readonly sideLabel: 'Vorderseite' | 'Rückseite'
  }
}

export interface TechnicalPlanDxfCandidate {
  readonly document: TechnicalDrawingDocument
  readonly metadata: TechnicalPlanDxfMetadata
}

export interface PreparedTechnicalPlanDxf {
  readonly scope: TechnicalPlanDxfScope
  readonly filename: string
  readonly drawings: readonly TechnicalPlanDxfCandidate[]
}

export type TechnicalPlanDxfErrorCode = 'missing-drawing' | 'drawing-incomplete' | 'drawing-conflict'

export interface TechnicalPlanDxfError {
  readonly code: TechnicalPlanDxfErrorCode
  readonly drawingType?: string
}

export type PrepareTechnicalPlanDxfResult =
  | { readonly ok: true; readonly value: PreparedTechnicalPlanDxf }
  | { readonly ok: false; readonly error: TechnicalPlanDxfError }

const planSetOrder: Readonly<Record<TechnicalDrawingView, number>> = {
  plan: 0,
  section: 1,
  'door-elevation': 2,
}

const requiredPlanSetViews: readonly TechnicalDrawingView[] = ['plan', 'section', 'door-elevation']

function formatIsoCalendarDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function createTechnicalPlanDxfMetadata(
  project: LiftPlanProject,
  document: TechnicalDrawingDocument,
  date: Date,
  doorSelection?: DoorDrawingDxfSelection,
): TechnicalPlanDxfMetadata {
  return {
    productName: 'LiftPlan',
    projectName: project.name,
    projectId: project.id,
    drawingType: document.title,
    version: project.schemaVersion,
    exportDate: formatIsoCalendarDate(date),
    unit: 'mm',
    doorSelection: doorSelection ? {
      landing: doorSelection.landing,
      sideLabel: doorSelection.side === 'front' ? 'Vorderseite' : 'Rückseite',
    } : undefined,
  }
}

export function createTechnicalPlanDxfFilename(
  projectName: string,
  scope: TechnicalPlanDxfScope,
  drawing: TechnicalPlanDxfCandidate,
): string {
  const project = sanitizeTechnicalDocumentFilenameSegment(projectName)
  if (scope === 'plan-set') return `LiftPlan_${project}_Plansatz.dxf`
  const drawingType = sanitizeTechnicalDocumentFilenameSegment(drawing.document.title)
  const selection = drawing.metadata.doorSelection
  const landing = selection ? `_Haltestelle-${selection.landing}` : ''
  const rear = selection?.sideLabel === 'Rückseite' ? '_Rueckseite' : ''
  return `LiftPlan_${project}_${drawingType}${landing}${rear}.dxf`
}

function compareCandidates(left: TechnicalPlanDxfCandidate, right: TechnicalPlanDxfCandidate): number {
  const viewOrder = planSetOrder[left.document.view] - planSetOrder[right.document.view]
  if (viewOrder !== 0) return viewOrder
  if (left.document.view !== 'door-elevation') return 0
  const landingOrder = (left.metadata.doorSelection?.landing ?? 0) - (right.metadata.doorSelection?.landing ?? 0)
  if (landingOrder !== 0) return landingOrder
  return (left.metadata.doorSelection?.sideLabel ?? '').localeCompare(right.metadata.doorSelection?.sideLabel ?? '')
}

function validateCandidate(candidate: TechnicalPlanDxfCandidate): TechnicalPlanDxfError | undefined {
  if (candidate.document.status === 'incomplete') {
    return { code: 'drawing-incomplete', drawingType: candidate.document.title }
  }
  if (candidate.document.status === 'conflict') {
    return { code: 'drawing-conflict', drawingType: candidate.document.title }
  }
  return undefined
}

/**
 * Validates and orders unscaled model-space drawing documents. Paper scale,
 * A4 fit, browser size, and SVG/PDF presentation data are intentionally absent.
 */
export function prepareTechnicalPlanDxf(input: {
  readonly scope: TechnicalPlanDxfScope
  readonly projectName: string
  readonly candidates: readonly TechnicalPlanDxfCandidate[]
}): PrepareTechnicalPlanDxfResult {
  if (input.scope === 'current' && input.candidates.length !== 1) {
    return { ok: false, error: { code: 'missing-drawing' } }
  }
  if (input.scope === 'plan-set') {
    const views = new Set(input.candidates.map((candidate) => candidate.document.view))
    const missing = requiredPlanSetViews.find((view) => !views.has(view))
    if (missing) return { ok: false, error: { code: 'missing-drawing' } }
  }

  const candidates = input.scope === 'plan-set'
    ? [...input.candidates].sort(compareCandidates)
    : [...input.candidates]
  for (const candidate of candidates) {
    const error = validateCandidate(candidate)
    if (error) return { ok: false, error }
  }
  const first = candidates[0]
  if (!first) return { ok: false, error: { code: 'missing-drawing' } }
  return {
    ok: true,
    value: {
      scope: input.scope,
      drawings: candidates,
      filename: createTechnicalPlanDxfFilename(input.projectName, input.scope, first),
    },
  }
}

export function technicalPlanDxfErrorMessage(error: TechnicalPlanDxfError): string {
  const drawing = error.drawingType ? ` „${error.drawingType}“` : ''
  if (error.code === 'drawing-conflict') {
    return `Die Zeichnung${drawing} kann wegen ungültiger Planungsgeometrie nicht als DXF exportiert werden.`
  }
  return `Für den DXF-Export fehlen erforderliche Planungsdaten${drawing}.`
}
