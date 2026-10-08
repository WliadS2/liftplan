import { PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import { AutoFitCamera } from '../camera/AutoFitCamera'
import { PassengerElevatorAssembly } from '../geometry/passenger/PassengerElevatorAssembly'
import { createPassengerMechanicalLayout } from '../geometry/passenger/mechanical/passenger-mechanical-layout'
import { createPassengerMechanicalComponents } from '../geometry/passenger/mechanical/mechanical-component-model'
import { createPassengerInstallationModel } from '../geometry/passenger/passenger-installation-model'
import type { LiftGeometryPlanningInput } from '../geometry/lift-geometry-planning-input'
import { PASSENGER_RUNTIME_VIEW_MODES, type ThreeViewMode } from './view-mode'
import type { MechanicalPlanningIssueCode } from '../geometry/passenger/mechanical/passenger-mechanical-layout'
import { createTractionDriveModel, type DriveIssueCode } from '../geometry/passenger/mechanical/traction-drive-model'
import { getPassengerCameraFrame, getPassengerCameraInstallationKey } from '../camera/passenger-camera-bounds'
import { PASSENGER_CAMERA_POLICIES } from '../camera/view-camera-policy'
import { useCarrierInspectionLevel } from './use-carrier-inspection-level'
import { createPassengerSafetyModel, type SafetyIssueCode } from '../geometry/passenger/mechanical/passenger-safety-model'
import { createPassengerDoorSystem, getDoorInspection, type DoorIssueCode } from '../geometry/passenger/doors/passenger-door-model'
import type { PassengerEntranceSide } from '../geometry/passenger/passenger-installation-model'
import { createPassengerSimulationModel, type PassengerVisualizationData, type SimulationModelResult } from '../../simulation/passenger-simulation-model'
import { createPassengerSimulationController } from '../../simulation/passenger-simulation'
import { useKinematicRuntime, withoutNominalSpeedKey } from './use-kinematic-runtime'
import { PassengerSimulationDriver } from './PassengerSimulationDriver'
import { PassengerSimulationControls, PassengerSimulationUnavailable } from './PassengerSimulationControls'

const doorMessages: Record<DoorIssueCode, string> = {
  'invalid-door-shape': 'Eine Türbaugruppe enthält widersprüchliche Geometriedaten.',
  'unsupported-door-type': 'Für diese Türanordnung ist noch keine Bauteildarstellung verfügbar.',
  'duplicate-door-identity': 'Türbaugruppen benötigen unterschiedliche Kennungen und Zugangsseiten.',
  'missing-door-reference': 'Eine Türbaugruppe verweist auf einen fehlenden Kabinenzugang.',
  'invalid-door-panel': 'Türblätter, Bauteilmaße oder Fahrwege passen nicht zusammen.',
  'invalid-door-sill': 'Schwellenprofil und Bodenführung passen nicht zusammen.',
  'unmounted-door-component': 'Für eine Türbaugruppe fehlt eine passende explizite Befestigung.',
  'invalid-door-operator': 'Der Türantrieb passt nicht zur Befestigung über dem Kabinenzugang.',
  'invalid-door-drive-path': 'Der explizite Antriebsverlauf passt nicht zu den Türantriebsrollen.',
  'invalid-door-coupling': 'Die Kupplung passt nicht zum angegebenen Türblatt oder Anschluss.',
  'invalid-door-interlock': 'Die Verriegelungsdarstellung passt nicht zur zugehörigen Schachttür.',
  'invalid-door-level': 'Eine Schachttür verweist auf ungültige Haltestellendaten.',
  'entrance-axis-mismatch': 'Kabinen- und Schachtzugang liegen nicht auf derselben Zugangsachse.',
  'door-width-exceeds-cabin-entrance': 'Die angegebene Türbreite passt nicht in den Kabinenzugang.',
  'door-height-exceeds-cabin-entrance': 'Die angegebene Türhöhe passt nicht in den Kabinenzugang.',
  'door-panel-outside-entrance': 'Ein Türblatt liegt außerhalb des zugehörigen Zugangs.',
}

const safetyMessages: Record<SafetyIssueCode, string> = {
  'invalid-safety-shape': 'Eine Sicherheitsbaugruppe enthält widersprüchliche Geometriedaten.',
  'outside-safety-envelope': 'Eine Sicherheitsbaugruppe liegt außerhalb des angegebenen Schachts oder der Grube.',
  'unmounted-safety-wheel': 'Für eine Sicherheitsrolle fehlt eine passende explizite Befestigung.',
  'missing-safety-rail': 'Eine Fangvorrichtung verweist auf eine fehlende Kabinenschiene.',
  'duplicate-safety-gear': 'Die Fangvorrichtungen benötigen unterschiedliche Seiten und Schienen.',
  'unsupported-safety-gear': 'Für diesen Fangvorrichtungstyp fehlt eine explizite Bauteilgeometrie.',
  'detached-safety-gear': 'Eine Fangvorrichtung passt nicht an den angegebenen Tragrahmen.',
  'invalid-safety-linkage': 'Das Gestänge passt nicht zu den angegebenen Anschlussstellen.',
  'invalid-governor-rope': 'Für das Begrenzerseil passen Rollen, Durchmesser oder Anschlüsse nicht zusammen.',
  'zero-length-safety-route': 'Der Begrenzerseilverlauf enthält einen Abschnitt ohne Länge.',
  'non-tangent-safety-route': 'Das Begrenzerseil schließt nicht tangential an eine Rolle an.',
  'safety-rope-intersects-solid': 'Das Begrenzerseil überschneidet eine bekannte Baugruppe.',
  'invalid-machine-brake': 'Die explizite Maschinenbremse passt nicht an die angegebene Maschine.',
}

const driveMessages: Record<DriveIssueCode, string> = {
  'invalid-drive-shape': 'Eine Antriebskomponente enthält widersprüchliche Geometriedaten.',
  'outside-drive-envelope': 'Eine Antriebskomponente liegt außerhalb des angegebenen Schachts.',
  'unsupported-machine': 'Für die Maschine fehlt eine passende explizite Auflagerung.',
  'machine-sheave-axis-mismatch': 'Welle und Treibscheibe passen räumlich nicht zusammen.',
  'invalid-suspension-data': 'Die expliziten Seil- und Anschlussdaten passen nicht zusammen.',
  'missing-route-reference': 'Ein Seilverlauf verweist auf eine fehlende Scheibe oder einen Anschluss.',
  'zero-length-route': 'Der Seilverlauf enthält einen Abschnitt ohne Länge.',
  'non-tangent-route': 'Der Seilverlauf schließt nicht tangential an die Scheibe an.',
  'rope-intersects-solid': 'Der Seilverlauf überschneidet eine bekannte Baugruppe.',
  'unsupported-hitch': 'Für diesen Anschlusstyp ist noch keine Geometrie verfügbar.',
}

const mechanicalPlanningMessages: Record<MechanicalPlanningIssueCode, string> = {
  'non-finite-coordinate': 'Eine mechanische Position enthält ungültige Koordinaten.',
  'non-positive-dimension': 'Ein mechanisches Planungsmaß muss größer als null sein.',
  'collapsed-rail-pair': 'Die beiden Führungsschienen liegen auf derselben Achse.',
  'outside-shaft': 'Eine geplante Komponente liegt außerhalb des angegebenen Schachts.',
  'frame-intersects-cabin': 'Die Schienenanordnung lässt keinen Rahmen um die angegebene Kabine zu.',
  'invalid-rail-axis': 'Die Kabinenschienen müssen auf einer gemeinsamen Querachse liegen.',
  'counterweight-intersects-cabin': 'Das geplante Gegengewicht überschneidet die Kabine.',
  'arrangement-mismatch': 'Die Gegengewichtposition passt nicht zur gewählten Anordnung.',
  'rail-pair-misses-assembly': 'Die Gegengewichtschienen passen nicht zur angegebenen Gegengewichtposition.',
  'buffer-outside-pit': 'Eine Pufferposition liegt außerhalb der angegebenen Grube.',
  'buffer-misses-assembly': 'Eine Pufferposition liegt nicht unter der zugehörigen Baugruppe.',
  'invalid-zone-offset': 'Der Zonenversatz passt nicht zur angegebenen Grube oder zum Schachtkopf.',
}

export interface ThreeConfiguratorViewportProps {
  readonly geometryInput?: LiftGeometryPlanningInput
  readonly initialViewMode?: ThreeViewMode
  readonly visualizationData?: PassengerVisualizationData
}

function ViewportFallback({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="viewport-fallback">
      <div className="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="empty-state-icon">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        <div className="empty-state-text">{children}</div>
      </div>
    </div>
  )
}

export function ThreeConfiguratorViewport({
  geometryInput,
  initialViewMode = 'overview',
  visualizationData,
}: ThreeConfiguratorViewportProps) {
  const [viewMode, setViewMode] = useState<ThreeViewMode>(initialViewMode)
  const [selectedLevelId, setSelectedLevelId] = useState<string>()
  const [selectedEntranceSide, setSelectedEntranceSide] = useState<PassengerEntranceSide>('front')
  const [cameraResetRevision, setCameraResetRevision] = useState(0)
  const modelResult = useMemo(() => geometryInput
    ? createPassengerInstallationModel(geometryInput)
    : undefined, [geometryInput])
  const model = modelResult && 'model' in modelResult ? modelResult.model : undefined
  const mechanicalLayout = useMemo(() =>
    geometryInput && model
      ? createPassengerMechanicalLayout(geometryInput, model)
      : undefined, [geometryInput, model])
  const mechanicalComponents = useMemo(() => mechanicalLayout
    ? createPassengerMechanicalComponents(geometryInput?.mechanical.components, mechanicalLayout)
    : undefined, [geometryInput, mechanicalLayout])
  const drive = useMemo(() => model && mechanicalLayout && mechanicalComponents
    ? createTractionDriveModel(geometryInput?.mechanical.drive, model, mechanicalLayout, mechanicalComponents)
    : undefined, [geometryInput, model, mechanicalLayout, mechanicalComponents])
  const safety = useMemo(() => model && mechanicalLayout && mechanicalComponents
    ? createPassengerSafetyModel(geometryInput?.mechanical.safety, model, mechanicalLayout, mechanicalComponents, drive?.machine)
    : undefined, [geometryInput, model, mechanicalLayout, mechanicalComponents, drive])
  const doors = useMemo(() => model ? createPassengerDoorSystem(geometryInput?.doors, model) : undefined, [model, geometryInput])
  const cameraInstallationKey = useMemo(() => model && mechanicalComponents && drive
    ? getPassengerCameraInstallationKey(model, mechanicalComponents, drive, safety, doors)
    : 'unavailable', [model, mechanicalComponents, drive, safety, doors])
  const simulationResult = useMemo((): SimulationModelResult | undefined => {
    return model && mechanicalLayout && mechanicalComponents && drive && safety && doors
      ? createPassengerSimulationModel({ planning: geometryInput!, installation: model, layout: mechanicalLayout, components: mechanicalComponents, drive, safety, doors }, visualizationData)
      : { status: 'unavailable', issues: [{ code: 'unavailable-data', path: 'installation' }] }
  }, [geometryInput, model, mechanicalLayout, mechanicalComponents, drive, safety, doors, visualizationData])
  const simulation = useKinematicRuntime(simulationResult!, geometryInput?.nominalSpeedMetresPerSecond,
    withoutNominalSpeedKey([geometryInput, visualizationData]), createPassengerSimulationController)
  const servedLevel = useCarrierInspectionLevel(simulation,model?.levels[0]?.id)
  const doorInspection = useMemo(() => doors && model
    ? getDoorInspection(doors, model.levels, selectedLevelId ?? servedLevel, selectedEntranceSide)
    : undefined, [doors, model, selectedLevelId, servedLevel, selectedEntranceSide])
  const cameraFrame = useMemo(() => model && mechanicalComponents && drive
    ? getPassengerCameraFrame(viewMode, model, mechanicalComponents, drive, safety, doors, doorInspection)
    : undefined, [viewMode, model, mechanicalComponents, drive, safety, doors, doorInspection])
  const doorSelectionKey = `${doorInspection?.level?.id ?? ''}:${doorInspection?.side ?? ''}`
  const cameraMotion = useMemo(() => simulation ? {
    identity: simulation,
    getOffset: (): readonly [number, number, number] => [0,
      PASSENGER_CAMERA_POLICIES[viewMode] === 'moving-detail' ? simulation.getPose().cabinOffsetY : 0, 0],
  } : undefined, [simulation, viewMode])

  return (
    <section
      className="workspace-panel viewport-panel"
      aria-labelledby="viewport-heading"
    >
      <div className="viewport-heading-row">
        <h2 id="viewport-heading">3D-Ansicht</h2>
        <div className="viewport-mode-controls" role="group" aria-label="Ansichtsmodus">
          {PASSENGER_RUNTIME_VIEW_MODES.map((mode) => <button key={mode.id}
            aria-pressed={viewMode === mode.id} type="button" onClick={() => setViewMode(mode.id)}>
            {mode.label}
          </button>)}
          <span className="viewport-mode-reset" />
          <button type="button" onClick={() => setCameraResetRevision((revision) => revision + 1)}>
            Ansicht zurücksetzen
          </button>
        </div>
      </div>

      {viewMode === 'doors' && model && doorInspection && <div className="viewport-mode-controls">
        {model.levels.length > 0 && <label>Haltestelle: <select aria-label="Haltestelle" value={doorInspection.level?.id ?? ''} onChange={(event) => setSelectedLevelId(event.target.value)}>
          {model.levels.map((level) => <option key={level.id} value={level.id}>{level.index + 1}</option>)}
        </select></label>}
        {doors && doors.cabin.length > 1 && <label>Zugang: <select aria-label="Zugang" value={doorInspection.side} onChange={(event) => setSelectedEntranceSide(event.target.value as PassengerEntranceSide)}>
          {doors.cabin.map((entry) => <option key={entry.id} value={entry.side}>{entry.side === 'front' ? 'Vorn' : 'Hinten'}</option>)}
        </select></label>}
      </div>}

      {simulation && <PassengerSimulationControls key={cameraInstallationKey} controller={simulation} />}
      {simulationResult && simulationResult.status !== 'available' && <PassengerSimulationUnavailable issues={simulationResult.issues} />}

      {!modelResult || modelResult.status === 'empty' ? (
        <ViewportFallback>
          <strong>Planungsdaten unvollständig</strong>
          <p>Erforderliche Werte eingeben, um das 3D-Modell zu generieren.</p>
        </ViewportFallback>
      ) : modelResult.status === 'invalid' && !model ? (
        <ViewportFallback>
          <strong>Geometriefehler</strong>
          <p>Die aktuellen Abmessungen erzeugen ein ungültiges Modell.</p>
        </ViewportFallback>
      ) : (
        <>
          <div className="viewport-canvas">
            <Canvas
              dpr={[1, 1.5]}
              fallback={
                <ViewportFallback>
                  3D-Ansicht konnte nicht geladen werden.
                </ViewportFallback>
              }
              gl={{
                alpha: false,
                antialias: true,
                powerPreference: 'high-performance',
              }}
            >
              <color attach="background" args={['#eef1f4']} />
              <PerspectiveCamera makeDefault fov={38} near={0.01} far={100} position={[4, 3, 6]} up={[0, 1, 0]} />
              <hemisphereLight
                color="#ffffff"
                groundColor="#94a3b8"
                intensity={1.4}
              />
              <directionalLight intensity={2.1} position={[5, 8, 6]} />
              <directionalLight intensity={0.7} position={[-4, 3, -5]} />

              {model && mechanicalLayout && mechanicalComponents && drive && safety && doors && doorInspection && (
                <PassengerSimulationDriver controller={simulation} doors={doors}><PassengerElevatorAssembly
                  mechanicalLayout={mechanicalLayout}
                  mechanicalComponents={mechanicalComponents}
                  drive={drive}
                  safety={safety}
                  doors={doors}
                  doorInspection={doorInspection}
                  model={model}
                  viewMode={viewMode}
                /></PassengerSimulationDriver>
              )}
              {cameraFrame && <AutoFitCamera frame={cameraFrame} motion={cameraMotion} request={{
                viewMode, installationKey: cameraInstallationKey, doorSelectionKey, resetRevision: cameraResetRevision,
              }} />}
            </Canvas>
          </div>
          <div className="viewport-notices">
          {modelResult.status === 'partial' && (
            <p className="viewport-status">
              Teilansicht – weitere Planungsdaten fehlen.
            </p>
          )}
          {modelResult.status === 'invalid' && (
            <p className="viewport-status" role="alert">
              Teilansicht – ungültige Planungsdaten werden nicht dargestellt.
            </p>
          )}
          {mechanicalLayout?.validation.state === 'incomplete' && (
            <p className="viewport-status">Mechanische Anordnung unvollständig – explizite Layoutdaten fehlen.</p>
          )}
          {mechanicalLayout?.validation.issues.map((issue, index) => (
            <p key={`${issue.code}-${index}`} className="viewport-status" role="alert">
              {mechanicalPlanningMessages[issue.code]}
            </p>
          ))}
          {mechanicalComponents && mechanicalComponents.missingData.length > 0 &&
            (mechanicalLayout?.carRails || mechanicalLayout?.counterweight) && (
              <p className="viewport-status">Bauteildarstellung unvollständig – explizite Geometriedaten fehlen.</p>
            )}
          {mechanicalComponents && mechanicalComponents.issues.length > 0 && (
            <p className="viewport-status" role="alert">Einzelne Bauteile können mit den angegebenen Geometriedaten nicht dargestellt werden.</p>
          )}
          {drive?.missingData.length ? <p className="viewport-status">Antriebsdarstellung unvollständig – explizite Bauteil- oder Seildaten fehlen.</p> : null}
          {drive?.validation.issues.map((issue, index) => <p key={`drive-${index}`} className="viewport-status" role="alert">{driveMessages[issue.code]}</p>)}
          {safety?.missingData.length ? <p className="viewport-status">Sicherheitsdarstellung unvollständig – explizite Bauteil- oder Seildaten fehlen.</p> : null}
          {viewMode === 'safety' && !geometryInput?.mechanical.safety && <p className="viewport-status">Keine expliziten Planungsdaten für Sicherheitsbaugruppen vorhanden.</p>}
          {safety?.validation.issues.map((issue, index) => <p key={`safety-${index}`} className="viewport-status" role="alert">{safetyMessages[issue.code]}</p>)}
          {(geometryInput?.doors || viewMode === 'doors') && !!doors?.missingData.length && <p className="viewport-status">Türdarstellung unvollständig – explizite Bauteildaten fehlen.</p>}
          {doors?.validation.issues.map((issue, index) => <p key={`doors-${index}`} className="viewport-status" role="alert">{doorMessages[issue.code]}</p>)}
          {viewMode === 'doors' && doorInspection?.level && !doorInspection.cabinAtLevel && !simulation && <p className="viewport-status">Die Kabine bleibt an ihrer Ausgangsposition. Fokus: Schachttür der gewählten Haltestelle.</p>}
                  </div>
        </>
      )}

      <p className="panel-note">
        Planungsvisualisierung ohne Nachweis technischer oder normativer
        Konformität.
      </p>
    </section>
  )
}
