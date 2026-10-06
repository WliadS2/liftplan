import type { CarLiftSceneModel } from '../../elevator/car/car-lift-scene-model'
import { CAR_CONTACT_SYMBOL_RADIUS_METRES, createCarLiftRenderModel, type CarSceneAssembly, type CarLiftViewMode } from '../geometry/car/car-lift-render-model'
import type { CameraBounds, CameraFrame, CameraVector } from './camera-fit'

/** Rotation-aware render-space bounds; engineering envelopes are not changed by camera fitting. */
export function getCarAssemblyBounds(assemblies: readonly CarSceneAssembly[]): CameraBounds {
  const points: readonly number[][] = assemblies.flatMap((a) => {
    if ('start' in a) return [[...a.start], [...a.end]]
    const angle = (a.headingDegrees ?? 0) * Math.PI / 180
    const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle))
    const r = a.kind === 'wheel-contact' ? CAR_CONTACT_SYMBOL_RADIUS_METRES : 0
    const half = [cos * a.size[0] / 2 + sin * a.size[2] / 2 + r, a.size[1] / 2,
      sin * a.size[0] / 2 + cos * a.size[2] / 2 + r]
    return [a.center.map((v, i) => v - half[i]), a.center.map((v, i) => v + half[i])]
  })
  const vector = (coordinate: (axis: number) => number): CameraVector => [coordinate(0), coordinate(1), coordinate(2)]
  const min = vector((i) => points.length ? Math.min(...points.map((p) => p[i])) : 0)
  const max = vector((i) => points.length ? Math.max(...points.map((p) => p[i])) : 0)
  return { min, max, center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] }
}
const directions: Readonly<Record<CarLiftViewMode, CameraVector>> = {
  overview: [1, 0.6, 1], platform: [1, 0.7, 1], vehicle: [0.6, 1.3, 1],
  doors: [0.35, 0.12, 1], approach: [0.7, 1.4, 1], cutaway: [0.65, 0.25, 1],
}
export function getCarLiftCameraFrame(scene: CarLiftSceneModel, viewMode: CarLiftViewMode): CameraFrame {
  const visible = createCarLiftRenderModel(scene, viewMode).assemblies
  const bounds = getCarAssemblyBounds(visible.length ? visible : scene.assemblies)
  return { bounds, target: bounds.center, direction: directions[viewMode] }
}
export function getCarLiftCameraInstallationKey(scene: CarLiftSceneModel): string {
  return JSON.stringify(scene.assemblies)
}
