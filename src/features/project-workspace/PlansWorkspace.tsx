import { useMemo, useState } from 'react'
import {
  createPassengerDoorElevationDrawing,
  createPassengerPlanDrawing,
  createPassengerSectionDrawing,
  getAvailableDoorSides,
  type PassengerDrawingContext,
} from '../../drawings/passenger-technical-drawings'
import { TechnicalDrawingSvg } from '../../drawings/TechnicalDrawingSvg'
import { createTechnicalDrawingPresentation, TECHNICAL_DRAWING_SCALES, type TechnicalDrawingScale } from '../../drawings/technical-drawing'
import type { PassengerEntranceSide } from '../../three/geometry/passenger/passenger-installation-model'

type PlansView = 'plan' | 'section' | 'door'

const viewLabels: Record<PlansView, string> = { plan: 'Grundriss', section: 'Schnitt', door: 'Türansicht' }
const scaleLabels: Record<TechnicalDrawingScale, string> = {
  auto: 'Automatisch (Vorschau)', '1:20': '1:20', '1:25': '1:25', '1:50': '1:50', '1:100': '1:100',
}

export function PlansWorkspace({ context }: { readonly context?: PassengerDrawingContext }) {
  const [view, setView] = useState<PlansView>('plan')
  const [selectedLevelId, setSelectedLevelId] = useState<string>()
  const [selectedSide, setSelectedSide] = useState<PassengerEntranceSide>('front')
  const [scale, setScale] = useState<TechnicalDrawingScale>('auto')
  const levels = context?.inputs.installation.levels ?? []
  const sides = context ? getAvailableDoorSides(context) : []
  const levelId = levels.some((entry) => entry.id === selectedLevelId) ? selectedLevelId : levels[0]?.id
  const side = sides.includes(selectedSide) ? selectedSide : sides[0] ?? selectedSide
  const document = useMemo(() => {
    if (!context) return undefined
    if (view === 'plan') return createPassengerPlanDrawing(context, scale)
    if (view === 'section') return createPassengerSectionDrawing(context, scale)
    const currentLevels = context.inputs.installation.levels
    const currentSides = getAvailableDoorSides(context)
    const currentLevelId = currentLevels.some((entry) => entry.id === selectedLevelId) ? selectedLevelId : currentLevels[0]?.id
    const currentSide = currentSides.includes(selectedSide) ? selectedSide : currentSides[0] ?? selectedSide
    return createPassengerDoorElevationDrawing(context, { levelId: currentLevelId, side: currentSide }, scale)
  }, [context, scale, selectedLevelId, selectedSide, view])
  const presentation = useMemo(() => document ? createTechnicalDrawingPresentation(document) : undefined, [document])

  return <section className="workspace-panel plans-panel" aria-labelledby="plans-heading">
    <div className="plans-heading-row">
      <div>
        <h2 id="plans-heading">Pläne</h2>
        <p className="panel-note">Deterministische SVG-Vorschau aus den normalisierten Planungsdaten.</p>
      </div>
      <div className="plans-view-controls" role="group" aria-label="Planansicht">
        {(Object.keys(viewLabels) as PlansView[]).map((entry) => <button type="button" key={entry}
          aria-pressed={view === entry} onClick={() => setView(entry)}>{viewLabels[entry]}</button>)}
      </div>
    </div>
    <div className="plans-options">
      <label className="plans-option"><span>Maßstab</span><select value={scale}
        onChange={(event) => setScale(event.target.value as TechnicalDrawingScale)}>
        {TECHNICAL_DRAWING_SCALES.map((entry) => <option key={entry} value={entry}>{scaleLabels[entry]}</option>)}
      </select></label>
      {view === 'door' && <>
        <label className="plans-option"><span>Haltestelle</span><select value={levelId ?? ''}
          onChange={(event) => setSelectedLevelId(event.target.value || undefined)}>
          {levels.map((level) => <option key={level.id} value={level.id}>{level.index + 1}</option>)}
        </select></label>
        {sides.length > 1 && <label className="plans-option"><span>Zugang</span><select value={side}
          onChange={(event) => setSelectedSide(event.target.value as PassengerEntranceSide)}>
          {sides.map((entry) => <option key={entry} value={entry}>{entry === 'front' ? 'Vorne' : 'Hinten'}</option>)}
        </select></label>}
      </>}
    </div>
    {!document ? <p className="plans-empty">Planungsdaten eingeben, um die Pläne zu erzeugen.</p> : <>
      {document.status === 'conflict' && <p className="plans-warning" role="status">Planungsdaten enthalten Konflikte.</p>}
      {document.status === 'incomplete' && <p className="plans-warning" role="status">{document.incompleteMessage}</p>}
      {presentation?.fit === 'does-not-fit' && <p className="plans-warning" role="status">
        Die Zeichnung passt im Maßstab {scale} nicht auf A4.
      </p>}
      <div className="technical-drawing-frame"><TechnicalDrawingSvg document={document} presentation={presentation} /></div>
      <p className="plans-scale-note">{scale === 'auto'
        ? 'Automatisch eingepasste Bildschirmvorschau · nicht druckverbindlich.'
        : `A4-Papieransicht · Geometrie ${scale} · Browserdarstellung nicht druckverbindlich.`}</p>
    </>}
  </section>
}
