import { Bounds, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import { AutoFitCamera } from '../camera/AutoFitCamera'
import { PassengerElevatorAssembly } from '../geometry/passenger/PassengerElevatorAssembly'
import { createPassengerMechanicalLayout } from '../geometry/passenger/mechanical/passenger-mechanical-layout'
import { createPassengerMechanicalComponents } from '../geometry/passenger/mechanical/mechanical-component-model'
import { createPassengerInstallationModel } from '../geometry/passenger/passenger-installation-model'
import type { LiftGeometryPlanningInput } from '../geometry/lift-geometry-planning-input'
import type { ThreeViewMode } from './view-mode'
import type { MechanicalPlanningIssueCode } from '../geometry/passenger/mechanical/passenger-mechanical-layout'
import { createTractionDriveModel, type DriveIssueCode } from '../geometry/passenger/mechanical/traction-drive-model'
import { getPassengerCameraBounds } from '../camera/passenger-camera-bounds'
import { createPassengerSafetyModel, type SafetyIssueCode } from '../geometry/passenger/mechanical/passenger-safety-model'

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
}

function ViewportFallback({ children }: { readonly children: string }) {
  return <div className="viewport-fallback">{children}</div>
}

export function ThreeConfiguratorViewport({
  geometryInput,
  initialViewMode = 'overview',
}: ThreeConfiguratorViewportProps) {
  const [viewMode, setViewMode] = useState<ThreeViewMode>(initialViewMode)
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
  const cameraBounds = useMemo(() => mechanicalComponents && drive
    ? getPassengerCameraBounds(viewMode, mechanicalComponents, drive, safety)
    : undefined, [viewMode, mechanicalComponents, drive, safety])

  const frameKey =
    model
      ? [
          model.bounds.width,
          model.bounds.depth,
          model.bounds.height,
          model.levels.length,
          model.cabin ? 'cabin' : 'no-cabin',
          model.shaft ? 'shaft' : 'no-shaft',
          mechanicalLayout?.carFrame ? 'frame' : 'no-frame',
          mechanicalLayout?.counterweight ? 'counterweight' : 'no-counterweight',
          mechanicalLayout?.bounds.width,
          mechanicalLayout?.bounds.depth,
          mechanicalLayout?.bounds.height,
          mechanicalLayout?.bounds.centerY,
          mechanicalComponents?.bounds.width,
          mechanicalComponents?.bounds.height,
          mechanicalComponents?.bounds.depth,
          viewMode,
          cameraBounds?.min.join(','), cameraBounds?.max.join(','),
        ].join(':')
      : 'unavailable'

  return (
    <section
      className="workspace-panel viewport-panel"
      aria-labelledby="viewport-heading"
    >
      <div className="viewport-heading-row">
        <h2 id="viewport-heading">3D-Ansicht</h2>
        <div className="viewport-mode-controls" role="group" aria-label="Ansichtsmodus">
          <button
            aria-pressed={viewMode === 'overview'}
            type="button"
            onClick={() => setViewMode('overview')}
          >
            Gesamtansicht
          </button>
          <button
            aria-pressed={viewMode === 'mechanical'}
            type="button"
            onClick={() => setViewMode('mechanical')}
          >
            Mechanik
          </button>
          <button
            aria-pressed={viewMode === 'drive'}
            type="button"
            onClick={() => setViewMode('drive')}
          >
            Antrieb
          </button>
          <button
            aria-pressed={viewMode === 'safety'}
            type="button"
            onClick={() => setViewMode('safety')}
          >
            Sicherheit
          </button>
          <button
            aria-pressed={viewMode === 'cutaway'}
            type="button"
            onClick={() => setViewMode('cutaway')}
          >
            Schnittansicht
          </button>
        </div>
      </div>

      {!modelResult || modelResult.status === 'empty' ? (
        <ViewportFallback>
          Planungsdaten eingeben, um die 3D-Ansicht zu starten.
        </ViewportFallback>
      ) : modelResult.status === 'invalid' && !model ? (
        <ViewportFallback>
          Die eingegebenen Planungsmaße können nicht dargestellt werden.
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
              <PerspectiveCamera makeDefault fov={38} position={[4, 3, 6]} />
              <OrbitControls
                makeDefault
                dampingFactor={0.08}
                enableDamping
                maxPolarAngle={Math.PI * 0.92}
              />
              <hemisphereLight
                color="#ffffff"
                groundColor="#94a3b8"
                intensity={1.4}
              />
              <directionalLight intensity={2.1} position={[5, 8, 6]} />
              <directionalLight intensity={0.7} position={[-4, 3, -5]} />

              <Bounds margin={1.15}>
                {model && mechanicalLayout && mechanicalComponents && drive && safety && (
                  <PassengerElevatorAssembly
                    mechanicalLayout={mechanicalLayout}
                    mechanicalComponents={mechanicalComponents}
                    drive={drive}
                    safety={safety}
                    model={model}
                    viewMode={viewMode}
                  />
                )}
                <AutoFitCamera frameKey={frameKey} mechanicalBounds={cameraBounds} />
              </Bounds>
            </Canvas>
          </div>
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
        </>
      )}

      <p className="panel-note">
        Planungsvisualisierung ohne Nachweis technischer oder normativer
        Konformität.
      </p>
    </section>
  )
}
