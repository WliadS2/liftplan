import { millimetres } from '../engineering'
import type { DrawingBounds, TechnicalDrawingPage, TechnicalDrawingPresentation } from './technical-drawing'

export const TECHNICAL_SHEET_FRAME_MARGIN_MM = 9
export const TECHNICAL_SHEET_DRAWING_PADDING_MM = 6
export const TECHNICAL_SHEET_TITLE_BLOCK_HEIGHT_MM = 34
export const TECHNICAL_SHEET_TITLE_BLOCK_MAX_WIDTH_MM = 180

export interface PaperSpaceRectangle {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export interface PaperSpaceTranslation {
  readonly x: number
  readonly y: number
}

export interface TechnicalDrawingSheetLayout {
  readonly frame: PaperSpaceRectangle
  readonly drawingArea: PaperSpaceRectangle
  readonly titleArea: PaperSpaceRectangle
  readonly drawingTranslation: PaperSpaceTranslation
  readonly translatedDrawingBounds: DrawingBounds
  readonly fits: boolean
}

export interface TechnicalDrawingSheetMetadata {
  readonly productName: 'LiftPlan'
  readonly projectName: string
  readonly liftFamilyName: string
  readonly drawingType: string
  readonly drawingNumber: string
  readonly scale: string
  readonly date: string
  readonly projectNumber: string
  readonly version: string
  readonly sheetNumber: number
  readonly sheetCount: number
  readonly status: 'Planungsstand'
  readonly unit: 'mm'
  readonly doorSelection?: {
    readonly landing: number
    readonly sideLabel: 'Vorderseite' | 'Rückseite'
  }
}

export type TechnicalSheetPaperPrimitive = TechnicalSheetPaperRectangle | TechnicalSheetPaperLine | TechnicalSheetPaperText

interface TechnicalSheetPaperPrimitiveBase {
  readonly id: string
}

export interface TechnicalSheetPaperRectangle extends TechnicalSheetPaperPrimitiveBase {
  readonly kind: 'rectangle'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly stroke: string
  readonly strokeWidthMm: number
  readonly fill: string
}

export interface TechnicalSheetPaperLine extends TechnicalSheetPaperPrimitiveBase {
  readonly kind: 'line'
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly stroke: string
  readonly strokeWidthMm: number
}

export interface TechnicalSheetPaperText extends TechnicalSheetPaperPrimitiveBase {
  readonly kind: 'text'
  readonly x: number
  readonly y: number
  readonly text: string
  readonly fontSizeMm: number
  readonly fontWeight: 'normal' | 'bold'
  readonly fill: string
  readonly anchor: 'start' | 'middle' | 'end'
}

const black = '#000000'
const labelGrey = '#333333'

function rectangle(x: number, y: number, width: number, height: number): PaperSpaceRectangle {
  return { x, y, width, height, minX: x, minY: y, maxX: x + width, maxY: y + height }
}

function roundPaperCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000
}

function text(
  id: string,
  value: string,
  x: number,
  y: number,
  fontSizeMm: number,
  fontWeight: TechnicalSheetPaperText['fontWeight'] = 'normal',
  anchor: TechnicalSheetPaperText['anchor'] = 'start',
  fill = black,
): TechnicalSheetPaperText {
  return { id, kind: 'text', x, y, text: value, fontSizeMm, fontWeight, anchor, fill }
}

/**
 * Reserves paper space around an already fixed-scale drawing. It deliberately
 * derives only a translation; drawing dimensions and the A4 page mapping stay
 * untouched.
 */
export function createTechnicalDrawingSheetLayout(
  page: TechnicalDrawingPage,
  completeDrawingBounds: DrawingBounds,
): TechnicalDrawingSheetLayout {
  const frame = rectangle(
    TECHNICAL_SHEET_FRAME_MARGIN_MM,
    TECHNICAL_SHEET_FRAME_MARGIN_MM,
    page.widthMm - TECHNICAL_SHEET_FRAME_MARGIN_MM * 2,
    page.heightMm - TECHNICAL_SHEET_FRAME_MARGIN_MM * 2,
  )
  const titleWidth = Math.min(TECHNICAL_SHEET_TITLE_BLOCK_MAX_WIDTH_MM, frame.width)
  const titleArea = rectangle(
    frame.maxX - titleWidth,
    frame.maxY - TECHNICAL_SHEET_TITLE_BLOCK_HEIGHT_MM,
    titleWidth,
    TECHNICAL_SHEET_TITLE_BLOCK_HEIGHT_MM,
  )
  const drawingArea = rectangle(
    frame.minX + TECHNICAL_SHEET_DRAWING_PADDING_MM,
    frame.minY + TECHNICAL_SHEET_DRAWING_PADDING_MM,
    frame.width - TECHNICAL_SHEET_DRAWING_PADDING_MM * 2,
    titleArea.minY - frame.minY - TECHNICAL_SHEET_DRAWING_PADDING_MM * 2,
  )
  const drawingCenterX = (completeDrawingBounds.minX + completeDrawingBounds.maxX) / 2
  const drawingCenterY = (completeDrawingBounds.minY + completeDrawingBounds.maxY) / 2
  const targetCenterX = (drawingArea.minX + drawingArea.maxX) / 2
  const targetCenterY = (drawingArea.minY + drawingArea.maxY) / 2
  const drawingTranslation = {
    x: roundPaperCoordinate(targetCenterX - drawingCenterX),
    y: roundPaperCoordinate(targetCenterY - drawingCenterY),
  }
  const translatedDrawingBounds = {
    minX: millimetres(completeDrawingBounds.minX + drawingTranslation.x),
    minY: millimetres(completeDrawingBounds.minY + drawingTranslation.y),
    maxX: millimetres(completeDrawingBounds.maxX + drawingTranslation.x),
    maxY: millimetres(completeDrawingBounds.maxY + drawingTranslation.y),
  }
  const fits = translatedDrawingBounds.minX >= drawingArea.minX &&
    translatedDrawingBounds.maxX <= drawingArea.maxX &&
    translatedDrawingBounds.minY >= drawingArea.minY &&
    translatedDrawingBounds.maxY <= drawingArea.maxY

  return { frame, drawingArea, titleArea, drawingTranslation, translatedDrawingBounds, fits }
}

export function createTechnicalDrawingSheetLayoutFromPresentation(
  presentation: TechnicalDrawingPresentation,
): TechnicalDrawingSheetLayout | undefined {
  if (presentation.mode !== 'fixed-page' || !presentation.page) return undefined
  return createTechnicalDrawingSheetLayout(presentation.page, presentation.completeBounds)
}

/** Creates vector-only technical frame and title-block primitives in paper millimetres. */
export function createTechnicalDrawingSheetPaperPrimitives(
  layout: TechnicalDrawingSheetLayout,
  metadata: TechnicalDrawingSheetMetadata,
): readonly TechnicalSheetPaperPrimitive[] {
  const { frame, titleArea } = layout
  const mainHeight = 28
  const projectColumnWidth = titleArea.width * 0.42
  const drawingColumnWidth = titleArea.width * 0.21
  const metadataColumnWidth = titleArea.width * 0.22
  const projectDividerX = titleArea.x + projectColumnWidth
  const drawingDividerX = projectDividerX + drawingColumnWidth
  const metadataDividerX = drawingDividerX + metadataColumnWidth
  const projectX = titleArea.x + 2.5
  const drawingX = projectDividerX + 2.5
  const metadataX = drawingDividerX + 2.5
  const sheetX = metadataDividerX + 2.5
  const y = titleArea.y
  const primitives: TechnicalSheetPaperPrimitive[] = [
    {
      id: 'sheet-frame', kind: 'rectangle', x: frame.x, y: frame.y,
      width: frame.width, height: frame.height, stroke: black, strokeWidthMm: 0.35, fill: 'none',
    },
    {
      id: 'title-block', kind: 'rectangle', x: titleArea.x, y: titleArea.y,
      width: titleArea.width, height: titleArea.height, stroke: black, strokeWidthMm: 0.25, fill: '#ffffff',
    },
    {
      id: 'title-notice-divider', kind: 'line', x1: titleArea.x, y1: y + mainHeight,
      x2: titleArea.maxX, y2: y + mainHeight, stroke: black, strokeWidthMm: 0.18,
    },
    {
      id: 'title-project-divider', kind: 'line', x1: projectDividerX, y1: y,
      x2: projectDividerX, y2: y + mainHeight, stroke: black, strokeWidthMm: 0.18,
    },
    {
      id: 'title-drawing-divider', kind: 'line', x1: drawingDividerX, y1: y,
      x2: drawingDividerX, y2: y + mainHeight, stroke: black, strokeWidthMm: 0.18,
    },
    {
      id: 'title-metadata-divider', kind: 'line', x1: metadataDividerX, y1: y,
      x2: metadataDividerX, y2: y + mainHeight, stroke: black, strokeWidthMm: 0.18,
    },
    text('title-product', metadata.productName, projectX, y + 4.8, 3.9, 'bold'),
    text('title-project-label', 'Projekt:', projectX, y + 8.1, 1.35, 'bold', 'start', labelGrey),
    text('title-project-value', metadata.projectName, projectX, y + 10.8, 1.95),
    text('title-family-label', 'Aufzugstyp:', projectX, y + 14.3, 1.35, 'bold', 'start', labelGrey),
    text('title-family-value', metadata.liftFamilyName, projectX, y + 17, 1.95),

    text('title-drawing-label', 'Zeichnung:', drawingX, y + 3.5, 1.35, 'bold', 'start', labelGrey),
    text('title-drawing-value', metadata.drawingType, drawingX, y + 6.5, 2.55, 'bold'),
    text('title-drawing-number-label', 'Zeichnungsnummer:', drawingX, y + 10.1, 1.35, 'bold', 'start', labelGrey),
    text('title-drawing-number-value', metadata.drawingNumber, drawingX, y + 12.8, 1.55),
    text('title-scale-label', 'Maßstab:', drawingX, y + 16.3, 1.35, 'bold', 'start', labelGrey),
    text('title-scale-value', metadata.scale, drawingX, y + 19, 1.85),

    text('title-project-number-label', 'Projektnummer:', metadataX, y + 3.5, 1.35, 'bold', 'start', labelGrey),
    text('title-project-number-value', metadata.projectNumber, metadataX, y + 6.2, 1.45),
    text('title-version-label', 'Versionskennung:', metadataX, y + 10.1, 1.35, 'bold', 'start', labelGrey),
    text('title-version-value', metadata.version, metadataX, y + 12.8, 1.45),
    text('title-status-label', 'Status:', metadataX, y + 16.3, 1.35, 'bold', 'start', labelGrey),
    text('title-status-value', metadata.status, metadataX, y + 19, 1.6),

    text('title-sheet-label', 'Blatt:', sheetX, y + 3.5, 1.35, 'bold', 'start', labelGrey),
    text('title-sheet-value', `${metadata.sheetNumber} / ${metadata.sheetCount}`, sheetX, y + 6.2, 1.6),
    text('title-date-label', 'Datum:', sheetX, y + 10.1, 1.35, 'bold', 'start', labelGrey),
    text('title-date-value', metadata.date, sheetX, y + 12.8, 1.5),
    text('title-unit-label', 'Einheit:', sheetX, y + 16.3, 1.35, 'bold', 'start', labelGrey),
    text('title-unit-value', metadata.unit, sheetX, y + 19, 1.6),
    text(
      'title-notice',
      'Planungsdarstellung ohne Nachweis technischer oder normativer Konformität.',
      titleArea.x + titleArea.width / 2,
      y + 32.1,
      1.45,
      'normal',
      'middle',
    ),
  ]

  if (metadata.doorSelection) {
    primitives.push(text(
      'title-door-selection',
      `Haltestelle: ${metadata.doorSelection.landing} · Zugang: ${metadata.doorSelection.sideLabel}`,
      drawingX,
      y + 23.4,
      1.45,
      'normal',
    ))
  }

  return primitives
}
