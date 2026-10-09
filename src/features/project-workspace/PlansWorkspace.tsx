import { useMemo, useState } from 'react'
import {
  createLiftDoorElevationDrawing,
  createLiftPlanDrawing,
  createLiftSectionDrawing,
  getLiftDrawingLevels,
  getLiftDrawingSides,
  type LiftDrawingSide,
  type LiftFamilyDrawingContext,
} from '../../drawings/lift-family-technical-drawings'
import { PlanDrawingViewer } from './PlanDrawingViewer'
import { createTechnicalDrawingPresentation, TECHNICAL_DRAWING_SCALES, type TechnicalDrawingScale } from '../../drawings/technical-drawing'
import {
  createTechnicalPlanPdfMetadata,
  prepareTechnicalPlanPdf,
  technicalPlanPdfErrorMessage,
  type FixedTechnicalDrawingScale,
  type TechnicalPlanPdfCandidate,
  type TechnicalPlanPdfScope,
} from '../../documents/technical-plan-pdf'
import {
  createTechnicalPlanDxfMetadata,
  prepareTechnicalPlanDxf,
  technicalPlanDxfErrorMessage,
  type TechnicalPlanDxfCandidate,
} from '../../documents/technical-plan-dxf'
import type { LiftPlanProject } from '../../projects'

type PlansView = 'plan' | 'section' | 'door'

const viewLabels: Record<PlansView, string> = { plan: 'Grundriss', section: 'Schnitt', door: 'Türansicht' }
const scaleLabels: Record<TechnicalDrawingScale, string> = {
  auto: 'Automatisch (Vorschau)', '1:20': '1:20', '1:25': '1:25', '1:50': '1:50', '1:100': '1:100',
}

export function PlansWorkspace({ context, project }: {
  readonly context?: LiftFamilyDrawingContext
  readonly project: LiftPlanProject
}) {
  const [view, setView] = useState<PlansView>('plan')
  const [selectedLevelId, setSelectedLevelId] = useState<string>()
  const [selectedSide, setSelectedSide] = useState<LiftDrawingSide>('front')
  const [scale, setScale] = useState<TechnicalDrawingScale>('auto')
  const [exportScope, setExportScope] = useState<TechnicalPlanPdfScope>('current')
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'dxf'>()
  const [exportMessage, setExportMessage] = useState<{
    readonly kind: 'error' | 'success'
    readonly text: string
    readonly contextKey: string
  }>()
  const levels = useMemo(() => getLiftDrawingLevels(context), [context])
  const levelId = levels.some((entry) => entry.id === selectedLevelId) ? selectedLevelId : levels[0]?.id
  const sides = useMemo(() => getLiftDrawingSides(context,levelId), [context,levelId])
  const side = useMemo(
    () => sides.includes(selectedSide) ? selectedSide : sides[0] ?? selectedSide,
    [selectedSide, sides],
  )
  const document = useMemo(() => {
    if (!context) return undefined
    if (view === 'plan') return createLiftPlanDrawing(context, scale,levelId)
    if (view === 'section') return createLiftSectionDrawing(context, scale)
    const currentLevels = getLiftDrawingLevels(context)
    const currentLevelId = currentLevels.some((entry) => entry.id === selectedLevelId) ? selectedLevelId : currentLevels[0]?.id
    const currentSides = getLiftDrawingSides(context,currentLevelId)
    const currentSide = currentSides.includes(selectedSide) ? selectedSide : currentSides[0] ?? selectedSide
    return createLiftDoorElevationDrawing(context, { levelId: currentLevelId, side: currentSide }, scale)
  }, [context, scale, selectedLevelId, selectedSide, view,levelId])
  const presentation = useMemo(() => document ? createTechnicalDrawingPresentation(document) : undefined, [document])
  const previewSheet = useMemo(() => {
    if (!document) return undefined
    const selectedLanding = levels.find((entry) => entry.id === levelId)
    return createTechnicalPlanPdfMetadata(
      project,
      document,
      scale,
      new Date(),
      document.view === 'door-elevation' && selectedLanding ? { landing: selectedLanding.index + 1, side } : undefined,
    )
  }, [document, levelId, levels, project, scale, side])
  const fitWarningMessage = presentation?.fit === 'does-not-fit'
    ? `Die Zeichnung passt im Maßstab ${scale} nicht auf A4.`
    : undefined
  const exportContextKey = [project.id, project.updatedAt, view, scale, levelId ?? '', side, exportScope].join('|')

  const exportPdf = async () => {
    setExportMessage(undefined)
    if (scale === 'auto') {
      const result = prepareTechnicalPlanPdf({ scope: exportScope, scale, projectName: project.name, candidates: [] })
      if (!result.ok) setExportMessage({
        kind: 'error',
        text: technicalPlanPdfErrorMessage(result.error, exportScope),
        contextKey: exportContextKey,
      })
      return
    }

    const exportScale: FixedTechnicalDrawingScale = scale
    const exportDate = new Date()
    const selectedLanding = levels.find((entry) => entry.id === levelId)
    const doorSelection = selectedLanding ? { landing: selectedLanding.index + 1, side } : undefined
    const documents = !context ? [] : exportScope === 'current'
      ? document ? [document] : []
      : [
          createLiftPlanDrawing(context, exportScale,levelId),
          createLiftSectionDrawing(context, exportScale),
          createLiftDoorElevationDrawing(context, { levelId, side }, exportScale),
        ]
    const candidates: TechnicalPlanPdfCandidate[] = documents.map((entry) => ({
      document: entry,
      presentation: createTechnicalDrawingPresentation(entry),
      metadata: createTechnicalPlanPdfMetadata(
        project,
        entry,
        exportScale,
        exportDate,
        entry.view === 'door-elevation' ? doorSelection : undefined,
      ),
    }))
    const prepared = prepareTechnicalPlanPdf({
      scope: exportScope,
      scale: exportScale,
      projectName: project.name,
      candidates,
    })
    if (!prepared.ok) {
      setExportMessage({
        kind: 'error',
        text: technicalPlanPdfErrorMessage(prepared.error, exportScope),
        contextKey: exportContextKey,
      })
      return
    }

    setExportingFormat('pdf')
    try {
      const { downloadTechnicalPlanPdf, generateTechnicalPlanPdf } = await import('../../documents/technical-plan-pdf-renderer')
      const blob = await generateTechnicalPlanPdf(prepared.value)
      downloadTechnicalPlanPdf(blob, prepared.value.filename)
      setExportMessage({ kind: 'success', text: 'PDF wurde erstellt.', contextKey: exportContextKey })
    } catch (error) {
      console.error('Technical PDF export failed', error)
      setExportMessage({
        kind: 'error',
        text: 'Die PDF-Datei konnte nicht erstellt werden.',
        contextKey: exportContextKey,
      })
    } finally {
      setExportingFormat(undefined)
    }
  }

  const exportDxf = async () => {
    setExportMessage(undefined)
    const exportDate = new Date()
    const selectedLanding = levels.find((entry) => entry.id === levelId)
    const doorSelection = selectedLanding ? { landing: selectedLanding.index + 1, side } : undefined
    const currentModelDocument = !context ? undefined
      : view === 'plan' ? createLiftPlanDrawing(context, 'auto',levelId)
        : view === 'section' ? createLiftSectionDrawing(context, 'auto')
          : createLiftDoorElevationDrawing(context, { levelId, side }, 'auto')
    const documents = !context ? [] : exportScope === 'current'
      ? currentModelDocument ? [currentModelDocument] : []
      : [
          createLiftPlanDrawing(context, 'auto',levelId),
          createLiftSectionDrawing(context, 'auto'),
          createLiftDoorElevationDrawing(context, { levelId, side }, 'auto'),
        ]
    const candidates: TechnicalPlanDxfCandidate[] = documents.map((entry) => ({
      document: entry,
      metadata: createTechnicalPlanDxfMetadata(
        project,
        entry,
        exportDate,
        entry.view === 'door-elevation' ? doorSelection : undefined,
      ),
    }))
    const prepared = prepareTechnicalPlanDxf({
      scope: exportScope,
      projectName: project.name,
      candidates,
    })
    if (!prepared.ok) {
      setExportMessage({
        kind: 'error',
        text: technicalPlanDxfErrorMessage(prepared.error),
        contextKey: exportContextKey,
      })
      return
    }

    setExportingFormat('dxf')
    try {
      const { downloadTechnicalPlanDxf, generateTechnicalPlanDxf } = await import('../../documents/technical-plan-dxf-renderer')
      const content = generateTechnicalPlanDxf(prepared.value)
      downloadTechnicalPlanDxf(content, prepared.value.filename)
      setExportMessage({ kind: 'success', text: 'DXF wurde erstellt.', contextKey: exportContextKey })
    } catch (error) {
      console.error('Technical DXF export failed', error)
      setExportMessage({
        kind: 'error',
        text: 'Die DXF-Datei konnte nicht erstellt werden.',
        contextKey: exportContextKey,
      })
    } finally {
      setExportingFormat(undefined)
    }
  }

  return <div className="plans-workspace-container" aria-labelledby="plans-heading">
    <h2 id="plans-heading" className="sr-only" style={{ display: 'none' }}>Pläne</h2>
    <div className="plans-toolbar">
      <div className="plans-view-controls" role="group" aria-label="Planansicht">
        {(Object.keys(viewLabels) as PlansView[]).map((entry) => <button type="button" key={entry}
          aria-pressed={view === entry} onClick={() => setView(entry)}>{viewLabels[entry]}</button>)}
      </div>
      <div className="plans-options">
        <label className="plans-option"><span>Maßstab</span><select value={scale}
          onChange={(event) => setScale(event.target.value as TechnicalDrawingScale)}>
          {TECHNICAL_DRAWING_SCALES.map((entry) => <option key={entry} value={entry}>{scaleLabels[entry]}</option>)}
        </select></label>
        {view !== 'section' && <>
          <label className="plans-option"><span>Haltestelle</span><select value={levelId ?? ''}
            onChange={(event) => setSelectedLevelId(event.target.value || undefined)}>
            {levels.map((level) => <option key={level.id} value={level.id}>{level.label || `Haltestelle ${level.index + 1}`}</option>)}
          </select></label>
          {view === 'door' && sides.length > 1 && <label className="plans-option"><span>Zugang</span><select value={side}
            onChange={(event) => setSelectedSide(event.target.value as LiftDrawingSide)}>
            {sides.map((entry) => <option key={entry} value={entry}>{entry === 'front' ? 'Vorne' : 'Hinten'}</option>)}
          </select></label>}
        </>}
      </div>
      <fieldset className="plans-export-options">
        <legend>Exportieren</legend>
        <label><input type="radio" name="plan-export-scope" value="current" checked={exportScope === 'current'}
          onChange={() => setExportScope('current')} /> Aktuelle Ansicht</label>
        <label><input type="radio" name="plan-export-scope" value="plan-set" checked={exportScope === 'plan-set'}
          onChange={() => setExportScope('plan-set')} /> Gesamter Plansatz</label>
        <button className="btn-secondary" type="button" onClick={() => void exportPdf()} disabled={exportingFormat !== undefined}>
          {exportingFormat === 'pdf' ? 'PDF wird erstellt …' : 'PDF erstellen'}
        </button>
        <button className="btn-secondary" type="button" onClick={() => void exportDxf()} disabled={exportingFormat !== undefined}>
          {exportingFormat === 'dxf' ? 'DXF wird erstellt …' : 'DXF exportieren'}
        </button>
      </fieldset>
    </div>
    {exportMessage?.contextKey === exportContextKey && exportMessage.text !== fitWarningMessage && <p
      className={exportMessage.kind === 'error' ? 'plans-warning' : 'plans-export-success'} role="status">
      {exportMessage.text}
    </p>}
    {!document ? <p className="plans-empty">Planungsdaten eingeben, um die Pläne zu erzeugen.</p> : <>
      {document.status === 'conflict' && <p className="plans-warning" role="status">Planungsdaten enthalten Konflikte.</p>}
      {document.status === 'incomplete' && <p className="plans-warning" role="status">{document.incompleteMessage}</p>}
      {fitWarningMessage && <p className="plans-warning" role="status">{fitWarningMessage}</p>}
      {presentation && previewSheet && <PlanDrawingViewer document={document} presentation={presentation} sheet={previewSheet}
        resetKey={[project.id,document.id,scale,levelId,side].join('|')}/>}
      <p className="plans-scale-note">{scale === 'auto'
        ? 'Automatisch eingepasste Bildschirmvorschau · nicht druckverbindlich.'
        : `A4-Papieransicht · Geometrie ${scale} · Browserdarstellung nicht druckverbindlich.`}</p>
    </>}
  </div>
}
