import type { GoodsLiftSceneModel, GoodsSceneBox } from '../../elevator/goods/goods-lift-scene-model'
import { metres } from '../../engineering'
import { getCarrierDriveInspectionBounds } from './carrier-drive-camera'
import { isDriveKind } from '../geometry/carrier/drive-presentation'
import { getSemanticMovingFrame } from './semantic-moving-frame'
import { isGoodsMovingAssembly } from '../geometry/goods/goods-motion-bindings'
import type { CameraBounds, CameraFrame, CameraVector } from './camera-fit'
import { createGoodsLiftRenderModel, type GoodsLiftViewMode } from '../geometry/goods/goods-lift-render-model'

function boundsForAssemblies(assemblies: readonly GoodsSceneBox[]): CameraBounds {
  if (!assemblies.length) {
    return { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0], width: 0, height: 0, depth: 0 }
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  assemblies.forEach((assembly) => {
    assembly.center.forEach((coordinate, axis) => {
      const half = assembly.size[axis] / 2
      min[axis] = Math.min(min[axis], coordinate - half)
      max[axis] = Math.max(max[axis], coordinate + half)
    })
  })
  const center: CameraVector = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ]
  return {
    min, max, center,
    width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2],
  }
}

const kindSet = (scene: GoodsLiftSceneModel, kinds: readonly GoodsSceneBox['kind'][]) =>
  scene.assemblies.filter((assembly) => kinds.includes(assembly.kind))

function getGoodsDriveBounds(scene: GoodsLiftSceneModel, visible: readonly GoodsSceneBox[]) {
  const context = visible.filter((a) => !isDriveKind(a.kind))
    .map((a) => ({ center: a.center, size: a.size, moving: isGoodsMovingAssembly(a) }))
  return getCarrierDriveInspectionBounds(scene.drive, new Set(visible.map((a) => a.id)), 0, context)
}

function targetForMode(scene: GoodsLiftSceneModel, viewMode: GoodsLiftViewMode, fallback: CameraVector): CameraVector {
  if (viewMode === 'mechanical' || viewMode === 'drive' || viewMode === 'safety') return fallback
  if (viewMode === 'platform' || viewMode === 'loads') {
    const assemblies = kindSet(scene, viewMode === 'platform' ? ['platform', 'platform-floor']
      : ['platform', 'platform-floor', 'pallet', 'roll-container', 'forklift-envelope'])
    return assemblies.length ? boundsForAssemblies(assemblies).center : fallback
  }
  if (viewMode === 'doors') {
    const doors = kindSet(scene, ['door', 'landing-door'])
    return doors.length ? boundsForAssemblies(doors).center : fallback
  }
  const shaft = scene.assemblies.find((assembly) => assembly.kind === 'shaft')
  return shaft?.center ?? fallback
}

const viewDirections: Readonly<Record<GoodsLiftViewMode, CameraVector>> = {
  overview: [1, 0.65, 1],
  platform: [1, 0.8, 1],
  mechanical:[1,0.45,1], drive:[1,0.3,1], safety:[1,0.3,1],
  doors: [0.35, 0.12, 1],
  loads: [0.6, 1.1, 1],
  guides: [1, 0.35, 1],
  cutaway: [1, 0.12, 0.38],
}

export function getGoodsLiftCameraFrame(scene: GoodsLiftSceneModel, viewMode: GoodsLiftViewMode, includeVisualDoorTravel = false, doorLevelId?: string): CameraFrame {
  const visible = createGoodsLiftRenderModel(scene, viewMode,doorLevelId).assemblies
  // Reserve full schematic panel travel once, never re-fit on animation ticks.
  const cameraAssemblies = includeVisualDoorTravel ? visible.map((assembly) =>
    assembly.kind === 'door' || assembly.kind === 'landing-door'
      ? { ...assembly, size: [metres(assembly.size[0] * 2), assembly.size[1], assembly.size[2]] as GoodsSceneBox['size'] }
      : assembly) : visible
  // Optional carried-load envelopes must not shrink the installation overview.
  const framed = viewMode === 'overview' || viewMode === 'cutaway'
    ? cameraAssemblies.filter((a)=>!['pallet','roll-container','forklift-envelope','moving-envelope'].includes(a.kind))
    : cameraAssemblies
  const bounds = viewMode === 'drive' ? getGoodsDriveBounds(scene, visible) ?? boundsForAssemblies(framed)
    : boundsForAssemblies(framed)
  if (viewMode === 'overview' || viewMode === 'cutaway') {
    return { bounds,target:bounds.center,direction:viewDirections[viewMode] }
  }
  if (viewMode === 'doors') {
    const selectedLevel = doorLevelId ?? scene.assemblies.find((a)=>a.doorAttachment?.role === 'landing')?.doorAttachment
    const levelId = typeof selectedLevel === 'string' ? selectedLevel : selectedLevel?.role === 'landing' ? selectedLevel.levelId : undefined
    const doors = cameraAssemblies.filter((a)=>a.doorAttachment?.role === 'landing' && a.doorAttachment.levelId === levelId)
    if (doors.length) {
      // Frame both door layers at the served floor, without changing scene/model coordinates.
      const platformDoors = cameraAssemblies.filter((a)=>a.doorAttachment?.role === 'platform').map((a)=>({
        ...a,center:[a.center[0],metres(doors[0].center[1]-doors[0].size[1]/2+a.size[1]/2),a.center[2]] as GoodsSceneBox['center'],
      }))
      const local = boundsForAssemblies([...doors,...platformDoors])
      return {bounds:local,target:local.center,direction:viewDirections.doors}
    }
  }
  if (viewMode === 'platform' || viewMode === 'loads' || viewMode === 'guides') {
    const moving = cameraAssemblies.filter(isGoodsMovingAssembly)
    if (moving.length) return getSemanticMovingFrame(boundsForAssemblies(moving), viewDirections[viewMode],
      viewMode === 'guides' ? bounds : undefined)
  }
  return {
    bounds,
    target: targetForMode(scene, viewMode, bounds.center),
    direction: viewDirections[viewMode],
  }
}

export function getGoodsLiftCameraInstallationKey(scene: GoodsLiftSceneModel): string {
  return scene.assemblies.map((assembly) => [
    assembly.id, ...assembly.center.map((value) => Number(value.toFixed(6))),
    ...assembly.size.map((value) => Number(value.toFixed(6))),
  ].join(':')).join('|')+JSON.stringify(scene.drive)
}
