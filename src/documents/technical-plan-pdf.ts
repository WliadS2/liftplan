import { getLiftTypeDefinition } from '../elevator'
import {
  technicalDrawingScaleDenominator,
  type TechnicalDrawingDocument,
  type TechnicalDrawingPresentation,
  type TechnicalDrawingScale,
  type TechnicalDrawingView,
} from '../drawings/technical-drawing'
import type { LiftPlanProject } from '../projects'
import type { PassengerEntranceSide } from '../three/geometry/passenger/passenger-installation-model'
import type { TechnicalDrawingSheetMetadata } from '../drawings/technical-drawing-sheet'
import { sanitizeTechnicalDocumentFilenameSegment } from './technical-document-filename'
import { createTechnicalPlanPdfSheetLayoutFromPresentation } from './technical-plan-pdf-sheet'

export type FixedTechnicalDrawingScale = Exclude<TechnicalDrawingScale, 'auto'>
export type TechnicalPlanPdfScope = 'current' | 'plan-set'

export interface DoorDrawingPdfSelection {
  readonly landing: number
  readonly side: PassengerEntranceSide
}

export interface TechnicalPlanPdfMetadata extends TechnicalDrawingSheetMetadata {
  readonly scale: FixedTechnicalDrawingScale
  readonly doorSelection?: {
    readonly landing: number
    readonly sideLabel: 'Vorderseite' | 'Rückseite'
  }
}

export interface TechnicalPlanPdfCandidate {
  readonly document: TechnicalDrawingDocument
  readonly presentation: TechnicalDrawingPresentation
  readonly metadata: TechnicalPlanPdfMetadata
}

export interface TechnicalPlanPdfPage extends TechnicalPlanPdfCandidate {
  readonly metadata: TechnicalPlanPdfMetadata
  readonly presentation: TechnicalDrawingPresentation & {
    readonly mode: 'fixed-page'
    readonly page: NonNullable<TechnicalDrawingPresentation['page']>
    readonly fit: 'fits'
  }
}

export interface PreparedTechnicalPlanPdf {
  readonly scope: TechnicalPlanPdfScope
  readonly filename: string
  readonly pages: readonly TechnicalPlanPdfPage[]
}

export type TechnicalPlanPdfErrorCode =
  | 'fixed-scale-required'
  | 'missing-drawing'
  | 'drawing-incomplete'
  | 'drawing-conflict'
  | 'drawing-does-not-fit'
  | 'scale-mismatch'

export interface TechnicalPlanPdfError {
  readonly code: TechnicalPlanPdfErrorCode
  readonly drawingType?: string
  readonly scale?: TechnicalDrawingScale
}

export type PrepareTechnicalPlanPdfResult =
  | { readonly ok: true; readonly value: PreparedTechnicalPlanPdf }
  | { readonly ok: false; readonly error: TechnicalPlanPdfError }

const planSetOrder: Readonly<Record<TechnicalDrawingView, number>> = {
  plan: 0,
  section: 1,
  'door-elevation': 2,
}

const planSetDrawingTypes: Readonly<Record<TechnicalDrawingView, string>> = {
  plan: 'Grundriss',
  section: 'Schnitt',
  'door-elevation': 'Türansicht',
}

const drawingNumberPrefixes: Readonly<Record<TechnicalDrawingView, string>> = {
  plan: 'GR',
  section: 'SC',
  'door-elevation': 'DR',
}

export function formatGermanCalendarDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}.${date.getFullYear()}`
}

export function createTechnicalPlanPdfMetadata(
  project: LiftPlanProject,
  document: TechnicalDrawingDocument,
  scale: FixedTechnicalDrawingScale,
  date: Date,
  doorSelection?: DoorDrawingPdfSelection,
): TechnicalPlanPdfMetadata {
  return {
    productName: 'LiftPlan',
    projectName: project.name,
    liftFamilyName: getLiftTypeDefinition(project.liftFamily).displayName,
    drawingType: document.title,
    drawingNumber: createTechnicalPlanPdfDrawingNumber(project.id, document.view),
    scale,
    date: formatGermanCalendarDate(date),
    projectNumber: project.id,
    version: project.schemaVersion,
    sheetNumber: 1,
    sheetCount: 1,
    status: 'Planungsstand',
    unit: 'mm',
    doorSelection: doorSelection ? {
      landing: doorSelection.landing,
      sideLabel: doorSelection.side === 'front' ? 'Vorderseite' : 'Rückseite',
    } : undefined,
  }
}

/** A deterministic, presentation-only identifier. It is not a regulated document number. */
export function createTechnicalPlanPdfDrawingNumber(
  projectNumber: string,
  view: TechnicalDrawingView,
  sequence = 1,
): string {
  const projectShortId = sanitizePdfFilenameSegment(projectNumber).replace(/-/g, '').toUpperCase().slice(0, 8) || 'PROJECT'
  return `LP-${projectShortId}-${drawingNumberPrefixes[view]}-${String(sequence).padStart(3, '0')}`
}

export const sanitizePdfFilenameSegment = sanitizeTechnicalDocumentFilenameSegment

export function createTechnicalPlanPdfFilename(
  projectName: string,
  scope: TechnicalPlanPdfScope,
  drawingType: string,
  scale: FixedTechnicalDrawingScale,
): string {
  const contentName = scope === 'plan-set' ? 'Plansatz' : drawingType
  return `LiftPlan_${sanitizePdfFilenameSegment(projectName)}_${sanitizePdfFilenameSegment(contentName)}_${scale.replace(':', '-')}.pdf`
}

function missingPlanSetView(candidates: readonly TechnicalPlanPdfCandidate[]): TechnicalDrawingView | undefined {
  const views = new Set(candidates.map((candidate) => candidate.document.view))
  return (Object.keys(planSetOrder) as TechnicalDrawingView[]).find((view) => !views.has(view))
}

function comparePlanSetCandidates(left: TechnicalPlanPdfCandidate, right: TechnicalPlanPdfCandidate): number {
  const viewOrder = planSetOrder[left.document.view] - planSetOrder[right.document.view]
  if (viewOrder !== 0) return viewOrder
  if (left.document.view !== 'door-elevation') return 0
  const leftDoor = left.metadata.doorSelection
  const rightDoor = right.metadata.doorSelection
  const landingOrder = (leftDoor?.landing ?? 0) - (rightDoor?.landing ?? 0)
  if (landingOrder !== 0) return landingOrder
  return (leftDoor?.sideLabel ?? '').localeCompare(rightDoor?.sideLabel ?? '')
}

function validateCandidate(
  candidate: TechnicalPlanPdfCandidate,
  scale: TechnicalDrawingScale,
): TechnicalPlanPdfError | undefined {
  if (candidate.document.scale.requested !== scale || candidate.metadata.scale !== scale) {
    return { code: 'scale-mismatch', drawingType: candidate.document.title, scale }
  }
  if (candidate.document.status === 'incomplete') {
    return { code: 'drawing-incomplete', drawingType: candidate.document.title, scale }
  }
  if (candidate.document.status === 'conflict') {
    return { code: 'drawing-conflict', drawingType: candidate.document.title, scale }
  }
  if (candidate.presentation.mode !== 'fixed-page' || !candidate.presentation.page) {
    return { code: 'fixed-scale-required', drawingType: candidate.document.title, scale }
  }
  if (candidate.presentation.fit !== 'fits') {
    return { code: 'drawing-does-not-fit', drawingType: candidate.document.title, scale }
  }
  const sheetLayout = createTechnicalPlanPdfSheetLayoutFromPresentation(candidate.presentation)
  if (!sheetLayout?.fits) {
    return { code: 'drawing-does-not-fit', drawingType: candidate.document.title, scale }
  }
  return undefined
}

/**
 * Validates and orders an export without altering drawing geometry. The page
 * presentations are the already-scaled physical A4 source of truth.
 */
export function prepareTechnicalPlanPdf(input: {
  readonly scope: TechnicalPlanPdfScope
  readonly scale: TechnicalDrawingScale
  readonly projectName: string
  readonly candidates: readonly TechnicalPlanPdfCandidate[]
}): PrepareTechnicalPlanPdfResult {
  if (!technicalDrawingScaleDenominator(input.scale)) {
    return { ok: false, error: { code: 'fixed-scale-required', scale: input.scale } }
  }
  const fixedScale = input.scale as FixedTechnicalDrawingScale
  if (input.scope === 'current' && input.candidates.length !== 1) {
    return { ok: false, error: { code: 'missing-drawing' } }
  }
  if (input.scope === 'plan-set') {
    const missingView = missingPlanSetView(input.candidates)
    if (missingView) {
      return {
        ok: false,
        error: { code: 'missing-drawing', drawingType: planSetDrawingTypes[missingView] },
      }
    }
  }

  const candidates = input.scope === 'plan-set'
    ? [...input.candidates].sort(comparePlanSetCandidates)
    : [...input.candidates]
  for (const candidate of candidates) {
    const error = validateCandidate(candidate, input.scale)
    if (error) return { ok: false, error }
  }

  const viewSequence = new Map<TechnicalDrawingView, number>()
  const pages = candidates.map((candidate, index): TechnicalPlanPdfPage => {
    const sequence = (viewSequence.get(candidate.document.view) ?? 0) + 1
    viewSequence.set(candidate.document.view, sequence)
    return {
      ...candidate,
      metadata: {
        ...candidate.metadata,
        drawingNumber: createTechnicalPlanPdfDrawingNumber(candidate.metadata.projectNumber, candidate.document.view, sequence),
        sheetNumber: index + 1,
        sheetCount: candidates.length,
      },
    } as TechnicalPlanPdfPage
  })
  return {
    ok: true,
    value: {
      scope: input.scope,
      pages,
      filename: createTechnicalPlanPdfFilename(
        input.projectName,
        input.scope,
        pages[0].document.title,
        fixedScale,
      ),
    },
  }
}

export function technicalPlanPdfErrorMessage(
  error: TechnicalPlanPdfError,
  scope: TechnicalPlanPdfScope,
): string {
  const drawing = error.drawingType ? ` ${error.drawingType}` : ''
  const quotedDrawing = error.drawingType ? ` „${error.drawingType}“` : ''
  if (error.code === 'fixed-scale-required') {
    return 'Für den PDF-Export wählen Sie bitte einen festen Maßstab.'
  }
  if (error.code === 'drawing-does-not-fit') {
    return scope === 'plan-set'
      ? `Der Plansatz kann nicht exportiert werden. ${error.drawingType ?? 'Eine Zeichnung'} passt im Maßstab ${error.scale} nicht auf A4.`
      : `Die Zeichnung passt im Maßstab ${error.scale} nicht auf A4.`
  }
  if (error.code === 'drawing-incomplete' || error.code === 'missing-drawing') {
    return `Für den PDF-Export fehlen erforderliche Planungsdaten${drawing ? ` für${drawing}` : ''}.`
  }
  if (error.code === 'drawing-conflict') {
    return `Die Zeichnung${quotedDrawing} kann wegen ungültiger Planungsgeometrie nicht exportiert werden.`
  }
  return 'Die Zeichnungen verwenden nicht denselben festen Maßstab.'
}
