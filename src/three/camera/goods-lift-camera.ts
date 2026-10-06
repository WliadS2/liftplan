import type { GoodsLiftSceneModel, GoodsSceneBox } from '../../elevator/goods/goods-lift-scene-model'
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

function targetForMode(scene: GoodsLiftSceneModel, viewMode: GoodsLiftViewMode, fallback: CameraVector): CameraVector {
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
  doors: [0.35, 0.12, 1],
  loads: [0.6, 1.1, 1],
  guides: [1, 0.35, 1],
  cutaway: [0.65, 0.25, 1],
}

export function getGoodsLiftCameraFrame(scene: GoodsLiftSceneModel, viewMode: GoodsLiftViewMode): CameraFrame {
  const visible = createGoodsLiftRenderModel(scene, viewMode).assemblies
  const bounds = boundsForAssemblies(visible.length ? visible : scene.assemblies)
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
  ].join(':')).join('|')
}
