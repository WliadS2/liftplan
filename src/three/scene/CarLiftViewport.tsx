import { PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import { millimetresToMetres } from '../../engineering'
import { createCarSimulationModel } from '../../simulation/car-simulation'
import { createPlatformSimulationController } from '../../simulation/platform-simulation'
import { useKinematicRuntime, withoutNominalSpeedKey } from './use-kinematic-runtime'
import { useCarrierInspectionLevel } from './use-carrier-inspection-level'
import { PlatformSimulationControls, PlatformSimulationUnavailable } from './PlatformSimulationControls'
import { CarSimulationDriver } from './CarSimulationDriver'
import { createCarrierDoorLayouts } from '../geometry/carrier/carrier-door-model'
import type { CarLiftNormalizationResult } from '../../elevator/car/car-lift-model'
import type { CarLiftSceneModel } from '../../elevator/car/car-lift-scene-model'
import type { CarSpatialValidationResult } from '../../collision/car-lift-spatial-validation'
import { AutoFitCamera } from '../camera/AutoFitCamera'
import { getCarLiftCameraFrame, getCarLiftCameraInstallationKey } from '../camera/car-lift-camera'
import { CAR_CAMERA_POLICIES } from '../camera/view-camera-policy'
import { CarLiftAssembly } from '../geometry/car/CarLiftAssembly'
import { CAR_LIFT_VIEW_MODE_CATALOG, createCarLiftRenderModel, getCarLiftRenderLegend, type CarLiftViewMode } from '../geometry/car/car-lift-render-model'

export interface CarLiftViewportProps {
  readonly normalized: CarLiftNormalizationResult
  readonly sceneModel?: CarLiftSceneModel
  readonly validation: CarSpatialValidationResult
  readonly initialViewMode?: CarLiftViewMode
}
function Fallback({ children }: { readonly children: React.ReactNode }) {
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

export function CarLiftViewport({ normalized, sceneModel, validation, initialViewMode = 'overview' }: CarLiftViewportProps) {
  const [viewMode, setViewMode] = useState<CarLiftViewMode>(initialViewMode)
  const [resetRevision, setResetRevision] = useState(0)
  const installationKey = useMemo(() => sceneModel ? getCarLiftCameraInstallationKey(sceneModel) : 'empty', [sceneModel])
  const simulationResult = useMemo(() => createCarSimulationModel(normalized, validation), [normalized, validation])
  const simulation = useKinematicRuntime(simulationResult, 'model' in normalized ? normalized.model.nominalSpeedMetresPerSecond : undefined,
    withoutNominalSpeedKey(normalized), createPlatformSimulationController)
  const inspectionLevel = useCarrierInspectionLevel(simulation,'model' in normalized ? normalized.model.levels[0]?.id : undefined)
  const renderModel = useMemo(() => sceneModel ? createCarLiftRenderModel(sceneModel, viewMode,inspectionLevel) : undefined, [sceneModel, viewMode,inspectionLevel])
  const frame = useMemo(() => sceneModel ? getCarLiftCameraFrame(sceneModel, viewMode, inspectionLevel) : undefined, [sceneModel, viewMode, inspectionLevel])
  const doors = useMemo(()=>sceneModel ? createCarrierDoorLayouts(sceneModel.assemblies.filter((a)=>'center' in a)) : [],[sceneModel])
  const cameraMotion = useMemo(() => simulation ? { identity: simulation,
    getOffset: (): readonly [number, number, number] => [0,
      CAR_CAMERA_POLICIES[viewMode] === 'moving-detail' ? millimetresToMetres(simulation.getPose().platformOffsetMm) : 0, 0],
  } : undefined, [simulation, viewMode])
  const renderable = Boolean(sceneModel?.assemblies.length)
  return <section className="workspace-panel viewport-panel" aria-labelledby="car-viewport-heading">
    <div className="viewport-heading-row">
      <h2 id="car-viewport-heading">3D-Ansicht</h2>
      {renderable && <div className="viewport-mode-controls" role="group" aria-label="Ansichtsmodus">
        {CAR_LIFT_VIEW_MODE_CATALOG.map((mode) => <button key={mode.id} type="button"
          aria-pressed={viewMode === mode.id} onClick={() => setViewMode(mode.id)}>{mode.label}</button>)}
        <span className="viewport-mode-reset"/><button type="button" onClick={() => setResetRevision((v) => v + 1)}>Ansicht zurücksetzen</button>
      </div>}
    </div>
    {simulation
      ? <PlatformSimulationControls controller={simulation} availability={simulationResult.status === 'available' ? simulationResult.availability : 'partial'}
          onReset={() => setResetRevision((v) => v + 1)} />
      : simulationResult.status !== 'available' && <PlatformSimulationUnavailable result={simulationResult} />}
    {simulation && simulationResult.status !== 'available' && <PlatformSimulationUnavailable result={simulationResult} />}
    {!sceneModel || !sceneModel.assemblies.length ? <Fallback><strong>Planungsdaten unvollständig</strong><p>Erforderliche Werte eingeben, um das 3D-Modell zu generieren.</p></Fallback> : <>
      <div className="viewport-canvas">
        <Canvas dpr={[1, 1.5]} gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}
          fallback={<Fallback>3D-Ansicht konnte nicht geladen werden.</Fallback>}>
          <color attach="background" args={['#eef1f4']} />
          <PerspectiveCamera makeDefault fov={38} near={0.01} far={100} position={[4, 3, 6]} up={[0, 1, 0]} />
          <hemisphereLight color="#ffffff" groundColor="#94a3b8" intensity={1.35} />
          <directionalLight intensity={1.8} position={[5, 8, 6]} />
          <directionalLight intensity={0.55} position={[-4, 3, -5]} />
          <CarSimulationDriver controller={simulation} doors={doors}>{renderModel && <CarLiftAssembly model={renderModel} />}</CarSimulationDriver>
          {frame && <AutoFitCamera frame={frame} motion={cameraMotion} request={{ viewMode, installationKey, doorSelectionKey: viewMode === 'doors' ? inspectionLevel ?? '' : '', resetRevision }} />}
        </Canvas>
      </div>
      {!renderModel?.assemblies.length && <p className="viewport-status">Für diesen Ansichtsmodus fehlen Planungsdaten.</p>}
      {renderModel && <p className="panel-note" aria-label="3D-Legende">{getCarLiftRenderLegend(renderModel).join(' · ')}</p>}
      {normalized.status === 'partial' && <p className="viewport-status">Teilansicht – weitere Planungsdaten fehlen.</p>}
      {normalized.status === 'invalid' && <p className="viewport-status" role="alert">Teilansicht – ungültige Planungsdaten werden soweit darstellbar angezeigt.</p>}
      {validation.status === 'invalid' && normalized.status !== 'invalid' && <p className="viewport-status" role="alert">
        Die konfigurierte Geometrie enthält Konflikte und wird zur Prüfung weiterhin dargestellt.
      </p>}
    </>}
    <p className="panel-note">Planungsvisualisierung ohne Nachweis technischer oder normativer Konformität.</p>
  </section>
}
