import type { CarLiftSceneModel } from '../../elevator/car/car-lift-scene-model'
import { CAR_CONTACT_SYMBOL_RADIUS_METRES, createCarLiftRenderModel, type CarSceneAssembly, type CarLiftViewMode } from '../geometry/car/car-lift-render-model'
import type { CameraBounds, CameraFrame, CameraVector } from './camera-fit'
import { getSemanticMovingFrame } from './semantic-moving-frame'
import { isCarMovingAssembly } from '../geometry/car/car-motion-bindings'
import { metres } from '../../engineering'
import { getCarrierDriveInspectionBounds } from './carrier-drive-camera'
import { isDriveKind } from '../geometry/carrier/drive-presentation'

function getCarDriveBounds(scene: CarLiftSceneModel, visible: readonly CarSceneAssembly[]) {
  const context = visible.flatMap((a) => 'center' in a && !isDriveKind(a.kind)
    ? [{ center: a.center, size: a.size, moving: isCarMovingAssembly(a) }] : [])
  return getCarrierDriveInspectionBounds(scene.drive, new Set(visible.map((a) => a.id)), 0, context)
}

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
  mechanical:[1,0.45,1], drive:[1,0.3,1], guides:[1,0.35,1], safety:[1,0.3,1],
  doors: [0.35, 0.12, 1], approach: [0.7, 1.4, 1], cutaway: [1, 0.12, 0.38],
}
export function getCarLiftCameraFrame(scene: CarLiftSceneModel, viewMode: CarLiftViewMode, doorLevelId?: string): CameraFrame {
  // Full schematic track/panel travel is render space only, reserved once, not per animation frame.
  const visible = createCarLiftRenderModel(scene, viewMode,doorLevelId).assemblies.map((a)=>
    'size' in a && (a.kind === 'door' || a.kind === 'landing-door')
      ? { ...a, size: [metres(a.size[0]*2),a.size[1],a.size[2]] as typeof a.size } : a)
  const framed = viewMode === 'overview' || viewMode === 'cutaway'
    ? visible.filter((a)=>!['vehicle-body','wheel-contact','vehicle-centerline','vehicle-axle','vehicle-reference','moving-envelope'].includes(a.kind))
    : visible
  const bounds = viewMode === 'drive' ? getCarDriveBounds(scene, visible) ?? getCarAssemblyBounds(framed)
    : getCarAssemblyBounds(framed)
  if (viewMode === 'overview' || viewMode === 'cutaway') return {bounds,target:bounds.center,direction:directions[viewMode]}
  if (viewMode === 'doors') {
    const firstDoor = scene.assemblies.find((a)=>'doorAttachment' in a && a.doorAttachment?.role === 'landing')
    const levelId = doorLevelId ?? (firstDoor && 'doorAttachment' in firstDoor && firstDoor.doorAttachment?.role === 'landing' ? firstDoor.doorAttachment.levelId : undefined)
    const doors = visible.filter((a)=>'doorAttachment' in a && a.doorAttachment?.role === 'landing' && a.doorAttachment.levelId === levelId)
    const landing = doors.find((a)=>'center' in a)
    if (landing && 'center' in landing) {
      const platformDoors = visible.flatMap((a)=>'center' in a && a.doorAttachment?.role === 'platform' ? [{
        ...a,center:[a.center[0],metres(landing.center[1]-landing.size[1]/2+a.size[1]/2),a.center[2]] as typeof a.center,
      }] : [])
      const local = getCarAssemblyBounds([...doors,...platformDoors])
      return {bounds:local,target:local.center,direction:directions.doors}
    }
  }
  if (viewMode === 'platform' || viewMode === 'vehicle' || viewMode === 'guides') {
    const moving = visible.filter(isCarMovingAssembly)
    if (moving.length) return getSemanticMovingFrame(getCarAssemblyBounds(moving), directions[viewMode],viewMode === 'guides' ? bounds : undefined)
  }
  return { bounds, target: bounds.center, direction: directions[viewMode] }
}
export function getCarLiftCameraInstallationKey(scene: CarLiftSceneModel): string {
  return JSON.stringify([scene.assemblies,scene.drive])
}
