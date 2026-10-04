import { metres, millimetresToMetres, type Millimetres } from '../../../../engineering'
import { createMechanicalBounds, type MechanicalBounds, type MechanicalPoint } from './passenger-mechanical-layout'

export const drivePoint = (x: number, y: number, z: number): MechanicalPoint => [metres(x), metres(y), metres(z)]
export const toDrivePoint = (p: { xMm: Millimetres; yMm: Millimetres; zMm: Millimetres }): MechanicalPoint =>
  drivePoint(millimetresToMetres(p.xMm), millimetresToMetres(p.yMm), millimetresToMetres(p.zMm))
export const toDriveSize = (s: { widthMm: Millimetres; heightMm: Millimetres; depthMm: Millimetres }): MechanicalPoint =>
  drivePoint(millimetresToMetres(s.widthMm), millimetresToMetres(s.heightMm), millimetresToMetres(s.depthMm))
export function transformDrivePoint(local: MechanicalPoint, origin: MechanicalPoint, rotationY: number): MechanicalPoint {
  const c = Math.cos(rotationY), s = Math.sin(rotationY)
  return drivePoint(origin[0] + c * local[0] + s * local[2], origin[1] + local[1], origin[2] - s * local[0] + c * local[2])
}
export const positiveDriveDimensions = (values: readonly number[]) => values.every((v) => Number.isFinite(v) && v > 0)
// Floating-point construction epsilon only. Not a physical clearance/tolerance.
export const GEOMETRY_EPSILON = 1e-9
export const nearDriveValue = (a: number, b: number) => Math.abs(a - b) < GEOMETRY_EPSILON
export const driveDistance = (a: MechanicalPoint, b: MechanicalPoint) => Math.hypot(...a.map((v, i) => v - b[i]))
export function driveBoxBounds(center: MechanicalPoint, size: MechanicalPoint, rotationY = 0): MechanicalBounds {
  return createMechanicalBounds([-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) =>
    transformDrivePoint(drivePoint(x * size[0] / 2, y * size[1] / 2, z * size[2] / 2), center, rotationY)))))
}
export function driveBoundsOverlap(a: MechanicalBounds, b: MechanicalBounds): boolean {
  return [0, 1, 2].every((i) => a.min[i] < b.max[i] - GEOMETRY_EPSILON && a.max[i] > b.min[i] + GEOMETRY_EPSILON)
}
/** Slab clipping of a segment against an open AABB, expanded by explicit rope radius. */
export function ropeSegmentIntersects(a: MechanicalPoint, b: MechanicalPoint, solid: MechanicalBounds, radius: number): boolean {
  let lo = 0, hi = 1
  for (const i of [0, 1, 2]) {
    const min = solid.min[i] - radius + GEOMETRY_EPSILON, max = solid.max[i] + radius - GEOMETRY_EPSILON
    const delta = b[i] - a[i]
    if (Math.abs(delta) < GEOMETRY_EPSILON) {
      if (a[i] <= min || a[i] >= max) return false
    } else {
      const t1 = (min - a[i]) / delta, t2 = (max - a[i]) / delta
      lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2))
      if (lo >= hi) return false
    }
  }
  return hi > 0 && lo < 1
}
