import { useLayoutEffect, useRef, useState } from 'react'
import type { TechnicalDrawingDocument, TechnicalDrawingPresentation } from '../../drawings/technical-drawing'
import { automaticPreviewSheetSize, type TechnicalDrawingSheetMetadata } from '../../drawings/technical-drawing-sheet'
import { AutomaticDrawingSheetPreview } from '../../drawings/AutomaticDrawingSheetPreview'
import { TechnicalDrawingSvg } from '../../drawings/TechnicalDrawingSvg'
import { fitDrawingSheetToViewport } from './drawing-preview-fit'

export function PlanDrawingViewer({ document, presentation, sheet, resetKey }: {
  readonly document: TechnicalDrawingDocument
  readonly presentation: TechnicalDrawingPresentation
  readonly sheet: TechnicalDrawingSheetMetadata
  readonly resetKey: string
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const [size,setSize] = useState({width:0,height:0})
  useLayoutEffect(()=>{
    const node = viewport.current
    if (!node) return
    const measure = () => setSize(previous=>{
      const next = {width:node.clientWidth,height:node.clientHeight}
      return next.width === previous.width && next.height === previous.height ? previous : next
    })
    // Measure the actual remaining drawing viewport before paint, not window or toolbar size.
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(node)
    window.addEventListener('resize',measure)
    return ()=>{observer?.disconnect();window.removeEventListener('resize',measure)}
  },[])
  useLayoutEffect(()=>{
    if (viewport.current) {viewport.current.scrollTop=0;viewport.current.scrollLeft=0}
  },[resetKey])
  const fit = fitDrawingSheetToViewport(size,automaticPreviewSheetSize(document.view))
  return <div ref={viewport} className="technical-drawing-frame" data-drawing-viewport="true" data-preview-mode={presentation.mode}>
    {presentation.mode === 'automatic-fit'
      ? <AutomaticDrawingSheetPreview document={document} presentation={presentation} sheet={sheet}
          style={{width:fit.width,height:fit.height,visibility:fit.width > 0 ? 'visible' : 'hidden'}}/>
      : <TechnicalDrawingSvg document={document} presentation={presentation} sheet={sheet}/>}
  </div>
}
