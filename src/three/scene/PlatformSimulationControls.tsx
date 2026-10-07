import { useState, useSyncExternalStore } from 'react'
import type { PlatformSimulationController, PlatformSimulationModelResult, PlatformSimulationPhase } from '../../simulation/platform-simulation'

const phases: Record<PlatformSimulationPhase, string> = {
  idle: 'Bereit', 'door-closing': 'Türen schließen', moving: 'Fahrt',
  'door-opening': 'Türen öffnen', 'door-open': 'Türen geöffnet',
}
export function PlatformSimulationControls({ controller, availability, onReset }: {
  readonly controller: PlatformSimulationController; readonly availability: 'complete' | 'partial'; readonly onReset: () => void
}) {
  const { state, issues } = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const defaultTarget = controller.model.levels.find((level) => level.id !== state.currentLevel)!.id
  const [selection, setSelection] = useState({ controller, target: defaultTarget })
  // Controller replacement also invalidates local selection, without effect-driven stale state.
  const target = selection.controller === controller ? selection.target : defaultTarget
  const resting = state.phase === 'idle' || state.phase === 'door-open'
  const current = controller.model.levels.find((level) => level.id === state.currentLevel)!
  return <div className="development-simulation-controls">
    <p className="viewport-status">{availability === 'complete' ? 'Fahrdemo verfügbar.' : 'Fahrdemo teilweise verfügbar.'}
      {' '}Visualisierung ohne Nachweis des realen Fahrverhaltens.</p>
    <p className="panel-note">Vertikalfahrt mit Nenngeschwindigkeit, ohne Beschleunigungs- oder Bremsmodell. Geschwindigkeitsänderungen gelten ab der nächsten Fahrt.</p>
    {controller.model.family === 'goods' ? <p className="panel-note">Türblätter schematisch; keine Darstellung eines bestimmten Türantriebs.</p>
      : <p className="panel-note">Autoaufzug: vertikale Visualisierung; Türanimation und Fahrzeugdynamik nicht verfügbar.</p>}
    <div className="viewport-mode-controls" role="group" aria-label="Fahrdemo">
      <label>Zielhaltestelle: <select aria-label="Zielhaltestelle" value={target} disabled={!resting}
        onChange={(event) => setSelection({ controller, target: event.target.value })}>
        {controller.model.levels.map((level) => <option key={level.id} value={level.id}>{level.index + 1}</option>)}
      </select></label>
      <button type="button" disabled={!resting || target === state.currentLevel || controller.speedStatus !== 'available'}
        onClick={() => controller.dispatch({ type: 'start', targetLevel: target })}>Fahrt starten</button>
      <button type="button" disabled={resting || state.paused} onClick={() => controller.dispatch({ type: 'pause' })}>Pause</button>
      <button type="button" disabled={!state.paused} onClick={() => controller.dispatch({ type: 'resume' })}>Fortsetzen</button>
      <button type="button" onClick={() => { controller.dispatch({ type: 'reset' }); onReset() }}>Zurücksetzen</button>
    </div>
    <p className="viewport-status" role="status">
      {state.paused ? `Pausiert (${phases[state.phase]})` : phases[state.phase]} · Haltestelle {current.index + 1}
      {!resting ? ` → ${controller.model.levels.find((level) => level.id === state.targetLevel)!.index + 1}` : ''}
    </p>
    {issues.length > 0 && <p role="alert" className="viewport-status">Diese Aktion ist im aktuellen Zustand der Fahrdemo nicht verfügbar.</p>}
  </div>
}
export function PlatformSimulationUnavailable({ result }: { readonly result: Exclude<PlatformSimulationModelResult, { status: 'available' }> }) {
  const speedMissing = result.issues.some((issue) => issue.path === 'nominalSpeedMetresPerSecond')
  return <p className="viewport-status">{speedMissing ? 'Fahrdemo nicht verfügbar – positive Nenngeschwindigkeit angeben.' : result.status === 'invalid'
    ? 'Fahrdemo nicht verfügbar – geometrischer Konflikt oder ungültige Visualisierungsdaten.'
    : 'Fahrdemo nicht verfügbar – Planung unvollständig. Plattform, Schacht und mindestens zwei gültige Haltestellen angeben.'}</p>
}
