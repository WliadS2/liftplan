import type { MechanicalBounds, MechanicalPoint } from '../geometry/passenger/mechanical/passenger-mechanical-layout'

export type CameraVector = readonly [number, number, number]
export interface CameraViewport { readonly width: number; readonly height: number }
export interface CameraFit {
  readonly target: CameraVector
  readonly position: CameraVector
  readonly up: CameraVector
  readonly distance: number
  readonly minDistance: number
  readonly maxDistance: number
  readonly near: number
  readonly far: number
}

export const CAMERA_VERTICAL_FOV_DEGREES = 38
export const CAMERA_MIN_POLAR_ANGLE = Math.PI * 0.08
export const CAMERA_MAX_POLAR_ANGLE = Math.PI * 0.92
export const CAMERA_WORLD_UP: CameraVector = [0, 1, 0]
export const CAMERA_DEFAULT_DIRECTION: CameraVector = normalize([1, 0.65, 1])

const dot = (a: CameraVector, b: CameraVector) => a.reduce((sum, value, index) => sum + value * b[index], 0)
const subtract = (a: CameraVector, b: CameraVector): CameraVector => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: CameraVector, b: CameraVector): CameraVector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
function normalize(vector: CameraVector): CameraVector {
  const length = Math.hypot(...vector)
  return length > 0 ? [vector[0] / length, vector[1] / length, vector[2] / length] : [0, 0, 1]
}

function corners(bounds: MechanicalBounds): CameraVector[] {
  return [bounds.min[0], bounds.max[0]].flatMap((x) => [bounds.min[1], bounds.max[1]].flatMap((y) =>
    [bounds.min[2], bounds.max[2]].map((z): CameraVector => [x, y, z])))
}

/** Perspective fit for an arbitrary semantic target and a canonical, roll-free technical view direction. */
export function calculateCameraFit(bounds: MechanicalBounds, target: MechanicalPoint, viewport: CameraViewport,
  fovDegrees = CAMERA_VERTICAL_FOV_DEGREES, padding = 1.15, direction: CameraVector = CAMERA_DEFAULT_DIRECTION): CameraFit {
  const offsetDirection = normalize(direction)
  const forward = normalize([-offsetDirection[0], -offsetDirection[1], -offsetDirection[2]])
  const right = normalize(cross(forward, CAMERA_WORLD_UP))
  const screenUp = normalize(cross(right, forward))
  const verticalTangent = Math.tan(fovDegrees * Math.PI / 360)
  const aspect = Math.max(viewport.width, 1) / Math.max(viewport.height, 1)
  const horizontalTangent = verticalTangent * aspect
  let distance = 0
  for (const corner of corners(bounds)) {
    const relative = subtract(corner, target)
    const depth = dot(relative, forward)
    distance = Math.max(distance,
      padding * Math.abs(dot(relative, right)) / horizontalTangent - depth,
      padding * Math.abs(dot(relative, screenUp)) / verticalTangent - depth)
  }
  distance = Math.max(distance, 0.5)
  const dimensions = [bounds.width, bounds.height, bounds.depth].filter((value) => value > 0)
  const smallestDimension = dimensions.length ? Math.min(...dimensions) : 1
  const diagonal = Math.max(Math.hypot(bounds.width, bounds.height, bounds.depth), 1)
  const minDistance = Math.max(0.08, smallestDimension * 0.15)
  const maxDistance = Math.max(distance * 5, diagonal * 5, minDistance * 10)
  const near = Math.max(0.01, minDistance * 0.04)
  const far = Math.max(maxDistance * 1.25, distance + diagonal * 2)
  return {
    target: [...target], up: CAMERA_WORLD_UP, distance, minDistance, maxDistance, near, far,
    position: [target[0] + offsetDirection[0] * distance, target[1] + offsetDirection[1] * distance, target[2] + offsetDirection[2] * distance],
  }
}
