import { useState, useSyncExternalStore } from 'react'
import type { PlatformSimulationController, PlatformSimulationModelResult, PlatformSimulationPhase } from '../../simulation/platform-simulation'

const phases: Record<PlatformSimulationPhase, string> = {
  idle: 'Bereit', 'door-closing': 'Türen schließen', moving: 'Fahrt',
  'door-opening': 'Türen öffnen', 'door-open': 'Türen geöffnet',
}
export function PlatformSimulationControls({ controller, availability, onReset }: {
  readonly controller: PlatformSimulationController; readonly availability: 'complete' | 'partial'; readonly onReset: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const { state, issues } = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const defaultTarget = controller.model.levels.find((level) => level.id !== state.currentLevel)!.id
  const [selection, setSelection] = useState({ controller, target: defaultTarget })
  const target = selection.controller === controller ? selection.target : defaultTarget
  const resting = state.phase === 'idle' || state.phase === 'door-open'
  const current = controller.model.levels.find((level) => level.id === state.currentLevel)!
  return <div className="simulation-controls">
    <div className="simulation-status-row" style={{ cursor: 'pointer' }} onClick={() => setCollapsed(!collapsed)}>
      <strong style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        Fahrdemo
      </strong>
      <span role="status">
        {state.paused ? `Pausiert (${phases[state.phase]})` : phases[state.phase]} · Haltestelle {current.index + 1}
        {!resting ? ` → ${controller.model.levels.find((level) => level.id === state.targetLevel)!.index + 1}` : ''}
      </span>
    </div>

    {!collapsed && (
      <>
    <div className="simulation-actions">
      <label>
        Zielhaltestelle
        <select aria-label="Zielhaltestelle" value={target} disabled={!resting} onChange={(event) => setSelection({ controller, target: event.target.value })}>
          {controller.model.levels.map((level) => <option key={level.id} value={level.id}>{level.index + 1}</option>)}
        </select>
      </label>
      <button className="btn-primary" type="button" disabled={!resting || target === state.currentLevel || controller.speedStatus !== 'available'} onClick={() => controller.dispatch({ type: 'start', targetLevel: target })}>▶ Fahrt starten</button>
      <button className="btn-secondary" type="button" disabled={resting || state.paused} onClick={() => controller.dispatch({ type: 'pause' })}>Pause</button>
      <button className="btn-secondary" type="button" disabled={!state.paused} onClick={() => controller.dispatch({ type: 'resume' })}>Fortsetzen</button>
      <button className="btn-tertiary" type="button" onClick={() => { controller.dispatch({ type: 'reset' }); onReset() }}>↺ Zurücksetzen</button>
    </div>

    <div style={{ marginTop: 'var(--space-8)' }}>
      <p className="viewport-status">{availability === 'complete' ? 'Fahrdemo verfügbar.' : 'Fahrdemo teilweise verfügbar.'}
        {' '}Visualisierung ohne Nachweis des realen Fahrverhaltens.</p>
      <p className="panel-note" style={{ position: 'relative', right: 'auto', bottom: 'auto', marginTop: 'var(--space-4)' }}>
        Vertikalfahrt mit Nenngeschwindigkeit.<br/>
        Ohne Beschleunigungs- oder Bremsmodell.
      </p>
      <p className="panel-note" style={{ position: 'relative', right: 'auto', bottom: 'auto', marginTop: 'var(--space-4)' }}>Türblätter, Türrahmen und Schwellen schematisch; keine Darstellung eines bestimmten Türantriebs.</p>
      {controller.model.family === 'car' && <p className="panel-note" style={{ position: 'relative', right: 'auto', bottom: 'auto', marginTop: 'var(--space-4)' }}>Autoaufzug: keine Fahrzeugfahr- oder Wendebewegung.</p>}
    </div>
    {issues.length > 0 && <p role="alert" className="viewport-status">Diese Aktion ist im aktuellen Zustand der Fahrdemo nicht verfügbar.</p>}
      </>
    )}
  </div>
}
export function PlatformSimulationUnavailable({ result }: { readonly result: Exclude<PlatformSimulationModelResult, { status: 'available' }> }) {
  const speedMissing = result.issues.some((issue) => issue.path === 'nominalSpeedMetresPerSecond')
  return <p className="viewport-status">{speedMissing ? 'Fahrdemo nicht verfügbar – positive Nenngeschwindigkeit angeben.' : result.status === 'invalid'
    ? 'Fahrdemo nicht verfügbar – geometrischer Konflikt oder ungültige Visualisierungsdaten.'
    : 'Fahrdemo nicht verfügbar – Planung unvollständig. Plattform, Schacht und mindestens zwei gültige Haltestellen angeben.'}</p>
}
