import { Bounds, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { AutoFitCamera } from '../camera/AutoFitCamera'
import { PassengerElevatorAssembly } from '../geometry/passenger/PassengerElevatorAssembly'
import { createPassengerInstallationModel } from '../geometry/passenger/passenger-installation-model'
import type { LiftGeometryPlanningInput } from '../geometry/lift-geometry-planning-input'

export interface ThreeConfiguratorViewportProps {
  readonly geometryInput?: LiftGeometryPlanningInput
}

function ViewportFallback({ children }: { readonly children: string }) {
  return <div className="viewport-fallback">{children}</div>
}

export function ThreeConfiguratorViewport({
  geometryInput,
}: ThreeConfiguratorViewportProps) {
  const modelResult = geometryInput
    ? createPassengerInstallationModel(geometryInput)
    : undefined

  const frameKey =
    modelResult?.status === 'ready'
      ? [
          modelResult.model.bounds.width,
          modelResult.model.bounds.depth,
          modelResult.model.bounds.height,
          modelResult.model.levels.length,
        ].join(':')
      : 'unavailable'

  return (
    <section
      className="workspace-panel viewport-panel"
      aria-labelledby="viewport-heading"
    >
      <h2 id="viewport-heading">3D-Ansicht</h2>

      {!modelResult || modelResult.status === 'incomplete' ? (
        <ViewportFallback>
          Für diese Konfiguration fehlen noch Planungsdaten.
        </ViewportFallback>
      ) : modelResult.status === 'invalid' ? (
        <ViewportFallback>
          Die eingegebenen Planungsmaße können nicht dargestellt werden.
        </ViewportFallback>
      ) : (
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

            <Bounds clip fit margin={1.2} observe>
              <PassengerElevatorAssembly model={modelResult.model} />
              <AutoFitCamera frameKey={frameKey} />
            </Bounds>
          </Canvas>
        </div>
      )}

      <p className="panel-note">
        Planungsvisualisierung ohne Nachweis technischer oder normativer
        Konformität.
      </p>
    </section>
  )
}
