import { useState, useSyncExternalStore } from 'react'
import type {
  PassengerSimulationCapabilityName,
  PassengerSimulationController,
  SimulationIssue,
  SimulationIssueCode,
  SimulationPhase,
} from '../../simulation/passenger-simulation'

const phases: Record<SimulationPhase, string> = {
  idle: 'Bereit',
  'door-closing': 'Türen schließen',
  moving: 'Fahrt',
  arriving: 'Ankunft',
  'door-opening': 'Türen öffnen',
  'door-open': 'Türen geöffnet',
}

const errors: Record<SimulationIssueCode, string> = {
  'unavailable-data': 'Für die Fahrdemo fehlen erforderliche Planungsdaten.',
  'invalid-timing': 'Die Visualisierungszeiten sind ungültig.',
  'unsupported-suspension': 'Dieser explizite Seilverlauf wird für die Fahrdemo noch nicht unterstützt.',
  'invalid-level': 'Die Zielhaltestelle ist ungültig.',
  'same-level': 'Eine andere Zielhaltestelle wählen.',
  'invalid-transition': 'Diese Aktion ist im aktuellen Zustand nicht verfügbar.',
  'doors-open': 'Eine Fahrt ist nur mit geschlossenen Türen möglich.',
  'outside-envelope': 'Die Fahrt liegt außerhalb der expliziten Bewegungsgrenzen.',
  'non-finite-pose': 'Die Bewegung enthält ungültige Koordinaten.',
  'invalid-clock': 'Die Zeitfortschreibung der Fahrdemo ist ungültig.',
  'invalid-route': 'Der Seilverlauf passt nicht zum angegebenen Bewegungsbereich.',
  'geometric-conflict': 'Die Fahrt ist wegen eines räumlichen Planungskonflikts nicht möglich.',
}

const capabilityMessages: Record<Exclude<PassengerSimulationCapabilityName, 'cabinMovement'>, string> = {
  counterweightMovement: 'Für die Gegengewichtsbewegung fehlen Layout- oder Seildaten.',
  doorMovement: 'Für die Türbewegung fehlen vollständige Türblattdaten.',
  tractionRotation: 'Für die Treibscheibenbewegung fehlen Antriebsdaten.',
  suspensionUpdate: 'Für die Seildarstellung fehlen Antriebsdaten.',
  governorUpdate: 'Für die Begrenzerseildarstellung fehlen Sicherheitsdaten.',
}

function unavailableMessage(issues: readonly SimulationIssue[]): string {
  const paths = new Set(issues.map((issue) => issue.path))
  if (paths.has('nominalSpeedMetresPerSecond')) return 'Für die Fahrdemo eine positive Nenngeschwindigkeit angeben.'
  if (paths.has('levels')) return 'Für die Fahrdemo werden mindestens zwei gültige Haltestellen benötigt.'
  if (paths.has('cabin')) return 'Für die Fahrdemo fehlen vollständige Kabinenmaße.'
  if (paths.has('cabin.travelEnvelope')) return 'Für die Fahrdemo fehlt ein gültiger Kabinenfahrbereich.'
  if (paths.has('currentLevel')) return 'Für die Fahrdemo fehlt eine gültige Ausgangshaltestelle.'
  return issues.map((issue) => errors[issue.code]).filter((message, index, all) => all.indexOf(message) === index).join(' ')
}

/** Compact intent/status UI; all timing and capability decisions stay in the pure simulation model. */
export function PassengerSimulationControls({ controller }: { readonly controller: PassengerSimulationController }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const { state } = snapshot
  const [targetLevel, setTargetLevel] = useState(
    controller.model.levels.find((level) => level.id !== state.currentLevel)?.id ?? state.currentLevel,
  )
  const current = controller.model.levels.find((level) => level.id === state.currentLevel)!
  const missingCapabilities = (Object.entries(controller.model.capabilities) as [PassengerSimulationCapabilityName, { available: boolean }][]) 
    .filter(([name, value]) => name !== 'cabinMovement' && !value.available)
    .map(([name]) => name as Exclude<PassengerSimulationCapabilityName, 'cabinMovement'>)
  const pose = import.meta.env.DEV ? controller.getPose() : undefined

  return <div className="development-simulation-controls">
    <p className="panel-note">Vertikalfahrt mit Nenngeschwindigkeit, ohne Beschleunigungs- oder Bremsmodell. Geschwindigkeitsänderungen gelten ab der nächsten Fahrt.</p>
    <p className="viewport-status">
      {missingCapabilities.length ? 'Fahrdemo teilweise verfügbar.' : 'Fahrdemo verfügbar.'}
      {' '}Visualisierung ohne Nachweis des realen Fahrverhaltens.
    </p>
    {missingCapabilities.length > 0 && <details className="viewport-status">
      <summary>Fehlende Teilfunktionen</summary>
      {missingCapabilities.map((name) => <p key={name}>{capabilityMessages[name]}</p>)}
    </details>}
    <div className="viewport-mode-controls" role="group" aria-label="Fahrdemo">
      <label>Zielhaltestelle: <select aria-label="Zielhaltestelle" value={targetLevel} disabled={state.phase !== 'idle'} onChange={(event) => setTargetLevel(event.target.value)}>
        {controller.model.levels.map((level) => <option key={level.id} value={level.id}>{level.index + 1}</option>)}
      </select></label>
      <button type="button" disabled={state.phase !== 'idle' || targetLevel === state.currentLevel || controller.speedStatus !== 'available'} onClick={() => controller.dispatch({ type: 'start', targetLevel })}>Fahrt starten</button>
      <button type="button" disabled={state.phase === 'idle' || state.paused} onClick={() => controller.dispatch({ type: 'pause' })}>Pause</button>
      <button type="button" disabled={!state.paused} onClick={() => controller.dispatch({ type: 'resume' })}>Fortsetzen</button>
      <button type="button" onClick={() => controller.dispatch({ type: 'reset' })}>Zurücksetzen</button>
    </div>
    <p className="viewport-status" role="status">
      {state.paused ? `Pausiert (${phases[state.phase]})` : phases[state.phase]} · Haltestelle {current.index + 1}
      {state.phase !== 'idle' ? ` → ${controller.model.levels.find((level) => level.id === state.targetLevel)!.index + 1}` : ''}
    </p>
    {import.meta.env.DEV && pose && <details className="viewport-status"><summary>Bewegungsdaten</summary>
      <p>Stand beim letzten Zustandswechsel: Kabinenboden {pose.cabinY.toFixed(3)} m
        {pose.counterweightY === undefined ? '' : ` · Gegengewichtmitte ${pose.counterweightY.toFixed(3)} m`}
        {' '}· Fahrfortschritt {(pose.travelProgress * 100).toFixed(1)} % · Türöffnung {(pose.cabinDoorProgress * 100).toFixed(1)} %
        {pose.tractionSheaveRotation === undefined ? '' : ` · Treibscheibenwinkel ${pose.tractionSheaveRotation.toFixed(3)} rad`}</p>
    </details>}
    {snapshot.issues.map((issue, index) => <p className="viewport-status" role="alert" key={index}>{errors[issue.code]}</p>)}
  </div>
}

export function PassengerSimulationUnavailable({ issues }: { readonly issues: readonly SimulationIssue[] }) {
  return <p className="viewport-status">{unavailableMessage(issues)}</p>
}
