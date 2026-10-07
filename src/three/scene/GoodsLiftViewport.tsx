import { PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import { createGoodsSimulationController, createGoodsSimulationModel } from '../../simulation/goods-simulation'
import { createGoodsVisualDoorLayouts } from '../geometry/goods/goods-motion-bindings'
import { GoodsSimulationDriver } from './GoodsSimulationDriver'
import { GoodsSimulationControls, GoodsSimulationUnavailable } from './GoodsSimulationControls'
import { millimetresToMetres } from '../../engineering'
import { useKinematicRuntime, withoutNominalSpeedKey } from './use-kinematic-runtime'
import { useCarrierInspectionLevel } from './use-carrier-inspection-level'
import type { GoodsLiftNormalizationResult } from '../../elevator/goods/goods-lift-model'
import type { GoodsLiftSceneModel } from '../../elevator/goods/goods-lift-scene-model'
import type { GoodsSpatialValidationResult } from '../../collision/goods-lift-spatial-validation'
import { AutoFitCamera } from '../camera/AutoFitCamera'
import { getGoodsLiftCameraFrame, getGoodsLiftCameraInstallationKey } from '../camera/goods-lift-camera'
import { GOODS_CAMERA_POLICIES } from '../camera/view-camera-policy'
import { GoodsLiftAssembly } from '../geometry/goods/GoodsLiftAssembly'
import {
  createGoodsLiftRenderModel,
  getAvailableGoodsLiftViewModes,
  getGoodsLiftRenderLegend,
  type GoodsLiftViewMode,
} from '../geometry/goods/goods-lift-render-model'

export interface GoodsLiftViewportProps {
  readonly normalized: GoodsLiftNormalizationResult
  readonly sceneModel?: GoodsLiftSceneModel
  readonly validation: GoodsSpatialValidationResult
  readonly initialViewMode?: GoodsLiftViewMode
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

export function GoodsLiftViewport({
  normalized,
  sceneModel,
  validation,
  initialViewMode = 'overview',
}: GoodsLiftViewportProps) {
  const [viewMode, setViewMode] = useState<GoodsLiftViewMode>(initialViewMode)
  const [cameraResetRevision, setCameraResetRevision] = useState(0)
  const availableModes = useMemo(() => sceneModel ? getAvailableGoodsLiftViewModes(sceneModel) : [], [sceneModel])
  const activeViewMode = availableModes.some((entry) => entry.id === viewMode) ? viewMode : 'overview'

  const installationKey = useMemo(() => sceneModel
    ? getGoodsLiftCameraInstallationKey(sceneModel) : 'unavailable', [sceneModel])
  const simulationResult = useMemo(() => createGoodsSimulationModel(normalized, validation), [normalized, validation])
  const simulation = useKinematicRuntime(simulationResult, 'model' in normalized ? normalized.model.nominalSpeedMetresPerSecond : undefined,
    withoutNominalSpeedKey(normalized), createGoodsSimulationController)
  const inspectionLevel = useCarrierInspectionLevel(simulation,'model' in normalized ? normalized.model.levels[0]?.id : undefined)
  const renderModel = useMemo(() => sceneModel
    ? createGoodsLiftRenderModel(sceneModel, activeViewMode,inspectionLevel) : undefined, [activeViewMode, sceneModel,inspectionLevel])
  const cameraFrame = useMemo(() => sceneModel
    ? getGoodsLiftCameraFrame(sceneModel, activeViewMode, true, inspectionLevel) : undefined, [activeViewMode, sceneModel, inspectionLevel])
  const doors = useMemo(() => sceneModel ? createGoodsVisualDoorLayouts(sceneModel) : [], [sceneModel])
  const cameraMotion = useMemo(() => simulation ? {
    identity: simulation,
    getOffset: (): readonly [number, number, number] => [0,
      GOODS_CAMERA_POLICIES[activeViewMode] === 'moving-detail' ? millimetresToMetres(simulation.getPose().platformOffsetMm) : 0, 0],
  } : undefined, [simulation, activeViewMode])

  return <section className="workspace-panel viewport-panel" aria-labelledby="goods-viewport-heading">
    <div className="viewport-heading-row">
      <h2 id="goods-viewport-heading">3D-Ansicht</h2>
      {sceneModel && <div className="viewport-mode-controls" role="group" aria-label="Ansichtsmodus">
        {availableModes.map((mode) => <button key={mode.id} type="button" aria-pressed={activeViewMode === mode.id}
          onClick={() => setViewMode(mode.id)}>{mode.label}</button>)}
        <span className="viewport-mode-reset"/><button type="button" onClick={() => setCameraResetRevision((revision) => revision + 1)}>Ansicht zurücksetzen</button>
      </div>}
    </div>

    {simulation
      ? <GoodsSimulationControls controller={simulation} availability={simulationResult.status === 'available' ? simulationResult.availability : 'partial'}
          onReset={() => setCameraResetRevision((revision) => revision + 1)} />
      : simulationResult.status !== 'available' && <GoodsSimulationUnavailable result={simulationResult} />}
    {simulation && simulationResult.status !== 'available' && <GoodsSimulationUnavailable result={simulationResult} />}

    {!sceneModel || normalized.status === 'empty' ? (
      <ViewportFallback><strong>Planungsdaten unvollständig</strong><p>Erforderliche Werte eingeben, um das 3D-Modell zu generieren.</p></ViewportFallback>
    ) : (
      <>
        <div className="viewport-canvas">
          <Canvas dpr={[1, 1.5]} fallback={<ViewportFallback>3D-Ansicht konnte nicht geladen werden.</ViewportFallback>}
            gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}>
            <color attach="background" args={['#eef1f4']} />
            <PerspectiveCamera makeDefault fov={38} near={0.01} far={100} position={[4, 3, 6]} up={[0, 1, 0]} />
            <hemisphereLight color="#ffffff" groundColor="#94a3b8" intensity={1.35} />
            <directionalLight intensity={1.8} position={[5, 8, 6]} />
            <directionalLight intensity={0.55} position={[-4, 3, -5]} />
            <GoodsSimulationDriver controller={simulation} doors={doors}>
              {renderModel && <GoodsLiftAssembly model={renderModel} doors={doors} />}
            </GoodsSimulationDriver>
            {cameraFrame && <AutoFitCamera frame={cameraFrame} motion={cameraMotion} request={{
              viewMode: activeViewMode, installationKey, doorSelectionKey: activeViewMode === 'doors' ? inspectionLevel ?? '' : '', resetRevision: cameraResetRevision,
            }} />}
          </Canvas>
        </div>
        {renderModel && <p className="panel-note" aria-label="3D-Legende">
          {getGoodsLiftRenderLegend(renderModel).map((entry) => <span key={entry.label}
            style={{ display: 'inline-block', marginRight: '0.8em' }}>
            <span aria-hidden="true" style={{ color: entry.color }}>━ </span>{entry.label}
          </span>)}
        </p>}
        {normalized.status === 'partial' && <p className="viewport-status">Teilansicht – weitere Planungsdaten fehlen.</p>}
        {normalized.status === 'invalid' && <p className="viewport-status" role="alert">
          Teilansicht – ungültige Planungsdaten werden soweit darstellbar angezeigt.
        </p>}
        {validation.status === 'invalid' && normalized.status !== 'invalid' && <p className="viewport-status" role="alert">
          Die konfigurierte Geometrie enthält Konflikte und wird zur Prüfung weiterhin dargestellt.
        </p>}
      </>
    )}
    <p className="panel-note">Planungsvisualisierung ohne Nachweis technischer oder normativer Konformität.</p>
  </section>
}
