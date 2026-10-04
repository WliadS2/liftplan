import { useState, useSyncExternalStore } from 'react'
import type { PassengerSimulationController, SimulationIssueCode, SimulationPhase } from '../simulation/passenger-simulation'
import { createSimulationPose } from '../simulation/passenger-simulation'

const phases: Record<SimulationPhase, string> = {
  idle: 'Bereit', 'door-closing': 'Türen schließen', moving: 'Fahrt', arriving: 'Ankunft',
  'door-opening': 'Türen öffnen', 'door-open': 'Türen geöffnet',
}
const errors: Record<SimulationIssueCode, string> = {
  'unavailable-data': 'Für die Fahrdemo fehlen explizite Layout- oder Visualisierungsdaten.',
  'invalid-timing': 'Die Demo-Zeitangaben sind ungültig.',
  'unsupported-suspension': 'Dieser explizite Seilverlauf wird für die Fahrdemo noch nicht unterstützt.',
  'invalid-level': 'Die Zielhaltestelle ist ungültig.', 'same-level': 'Eine andere Zielhaltestelle wählen.',
  'invalid-transition': 'Diese Aktion ist im aktuellen Zustand nicht verfügbar.',
  'doors-open': 'Eine Fahrt ist nur mit geschlossenen Türen möglich.',
  'outside-envelope': 'Die Fahrt liegt außerhalb der expliziten Bewegungsgrenzen.',
  'non-finite-pose': 'Die Bewegung enthält ungültige Koordinaten.',
  'invalid-clock': 'Die Demo-Zeitfortschreibung ist ungültig.',
  'invalid-route': 'Der Seilverlauf passt nicht zum angegebenen Bewegungsbereich.',
}

/** Small, DEV-only intent/status surface; no motion/timing decisions in presentation. */
export function DevelopmentSimulationControls({ controller }: { readonly controller: PassengerSimulationController }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const { state } = snapshot
  const pose = createSimulationPose(controller.model, state)
  const [targetLevel, setTargetLevel] = useState(controller.model.levels.find((level) => level.id !== state.currentLevel)?.id ?? state.currentLevel)
  const current = controller.model.levels.find((level) => level.id === state.currentLevel)!
  return <div className="development-simulation-controls">
    <p className="viewport-status">Fahrdemo – synthetische Visualisierungszeiten. Kein Nachweis des Fahrverhaltens.</p>
    <div className="viewport-mode-controls" role="group" aria-label="Fahrdemo">
      <label>Zielhaltestelle: <select aria-label="Zielhaltestelle" value={targetLevel} disabled={state.phase !== 'idle'} onChange={(event) => setTargetLevel(event.target.value)}>
        {controller.model.levels.map((level) => <option key={level.id} value={level.id}>{level.index + 1}</option>)}
      </select></label>
      <button type="button" disabled={state.phase !== 'idle' || targetLevel === state.currentLevel} onClick={() => controller.dispatch({ type: 'start', targetLevel })}>Fahrt starten</button>
      <button type="button" disabled={state.phase === 'idle' || state.paused} onClick={() => controller.dispatch({ type: 'pause' })}>Pause</button>
      <button type="button" disabled={!state.paused} onClick={() => controller.dispatch({ type: 'resume' })}>Fortsetzen</button>
      <button type="button" onClick={() => controller.dispatch({ type: 'reset' })}>Zurücksetzen</button>
    </div>
    <p className="viewport-status" role="status">{state.paused ? `Pausiert (${phases[state.phase]})` : phases[state.phase]} · Haltestelle {current.index + 1}{state.phase !== 'idle' ? ` → ${controller.model.levels.find((level) => level.id === state.targetLevel)!.index + 1}` : ''}</p>
    <details className="viewport-status"><summary>Bewegungsdaten</summary>
      <p>Stand beim letzten Zustandswechsel: Kabinenboden {pose.cabinY.toFixed(3)} m · Gegengewichtmitte {pose.counterweightY.toFixed(3)} m · Fahrfortschritt {(pose.travelProgress * 100).toFixed(1)} % · Türöffnung {(pose.cabinDoorProgress * 100).toFixed(1)} % · Treibscheibenwinkel {pose.tractionSheaveRotation.toFixed(3)} rad</p>
    </details>
    {snapshot.issues.map((issue, index) => <p className="viewport-status" role="alert" key={index}>{errors[issue.code]}</p>)}
  </div>
}

export function DevelopmentSimulationUnavailable({ codes }: { readonly codes: readonly SimulationIssueCode[] }) {
  return <p className="viewport-status">{[...new Set(codes)].map((code) => errors[code]).join(' ')}</p>
}
