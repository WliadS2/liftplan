import { Bounds, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import { AutoFitCamera } from '../camera/AutoFitCamera'
import { PassengerElevatorAssembly } from '../geometry/passenger/PassengerElevatorAssembly'
import { createPassengerMechanicalLayout } from '../geometry/passenger/mechanical/passenger-mechanical-layout'
import { createPassengerInstallationModel } from '../geometry/passenger/passenger-installation-model'
import type { LiftGeometryPlanningInput } from '../geometry/lift-geometry-planning-input'
import type { ThreeViewMode } from './view-mode'
import type { MechanicalPlanningIssueCode } from '../geometry/passenger/mechanical/passenger-mechanical-layout'

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
  const modelResult = geometryInput
    ? createPassengerInstallationModel(geometryInput)
    : undefined
  const model = modelResult && 'model' in modelResult ? modelResult.model : undefined
  const mechanicalLayout =
    geometryInput && model
      ? createPassengerMechanicalLayout(geometryInput, model)
      : undefined

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
          viewMode,
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
                {model && mechanicalLayout && (
                  <PassengerElevatorAssembly
                    mechanicalLayout={mechanicalLayout}
                    model={model}
                    viewMode={viewMode}
                  />
                )}
                <AutoFitCamera frameKey={frameKey} mechanicalBounds={mechanicalLayout?.bounds} />
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
        </>
      )}

      <p className="panel-note">
        Planungsvisualisierung ohne Nachweis technischer oder normativer
        Konformität.
      </p>
    </section>
  )
}
