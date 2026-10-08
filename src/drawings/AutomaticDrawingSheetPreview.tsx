import type { CSSProperties } from 'react'
import { millimetres as mm } from '../engineering'
import type { TechnicalDrawingDocument, TechnicalDrawingPresentation } from './technical-drawing'
import { automaticPreviewSheetSize, createTechnicalDrawingSheetLayout, createTechnicalDrawingSheetPaperPrimitives, TECHNICAL_SHEET_FRAME_MARGIN_MM, TECHNICAL_SHEET_TITLE_BLOCK_HEIGHT_MM, type TechnicalDrawingSheetMetadata } from './technical-drawing-sheet'
import { SheetPaperPrimitive, TechnicalDrawingSvg } from './TechnicalDrawingSvg'

/** Preview-only nested SVG viewports: whole A4 sheet versus model content are separate bounds.
 * The inner viewport fits all model annotations without changing any primitive or export scale. */
export function AutomaticDrawingSheetPreview({ document, presentation, sheet, style }: {
  readonly document: TechnicalDrawingDocument
  readonly presentation: TechnicalDrawingPresentation
  readonly sheet: TechnicalDrawingSheetMetadata
  readonly style: CSSProperties
}) {
  const size = automaticPreviewSheetSize(document.view)
  const bounds = { minX:mm(0), minY:mm(0), maxX:mm(size.width), maxY:mm(size.height) }
  const layout = createTechnicalDrawingSheetLayout({format:'A4',orientation:document.view === 'section' ? 'portrait' : 'landscape',
    widthMm:mm(size.width),heightMm:mm(size.height),marginMm:mm(TECHNICAL_SHEET_FRAME_MARGIN_MM),
    titleBlockReserveMm:mm(TECHNICAL_SHEET_TITLE_BLOCK_HEIGHT_MM),contentBounds:bounds}, bounds)
  return <svg className="technical-drawing-svg technical-drawing-automatic-sheet" role="img" aria-label={document.title}
    width={`${size.width}mm`} height={`${size.height}mm`} viewBox={`0 0 ${size.width} ${size.height}`}
    preserveAspectRatio="xMidYMid meet" style={style} data-preview-mode="automatic-sheet">
    <rect className="technical-paper" x="0" y="0" width={size.width} height={size.height}/>
    <TechnicalDrawingSvg document={document} presentation={presentation} embeddedViewport={layout.drawingArea}/>
    <g data-technical-sheet-paper-space="true">
      {createTechnicalDrawingSheetPaperPrimitives(layout,sheet).map((primitive)=><SheetPaperPrimitive key={primitive.id} primitive={primitive}/>)}
    </g>
  </svg>
}
