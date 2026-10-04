import { metres, type Metres } from '../engineering'

export type SpatialPoint = readonly [Metres, Metres, Metres]

export interface AxisAlignedBoundingBox {
  readonly min: SpatialPoint
  readonly max: SpatialPoint
}

export interface AxisAlignedPlanRectangle {
  readonly minX: Metres
  readonly maxX: Metres
  readonly minZ: Metres
  readonly maxZ: Metres
}

export interface GeometricClearances {
  readonly left: Metres
  readonly right: Metres
  readonly front: Metres
  readonly rear: Metres
  readonly top?: Metres
  readonly bottom?: Metres
}

export interface AxisSeparation {
  readonly x: Metres
  readonly y: Metres
  readonly z: Metres
  readonly distance: Metres
}

export type AabbRelationship = 'separated' | 'contact' | 'penetration'

export interface AabbIntersection {
  readonly relationship: AabbRelationship
  readonly overlap: SpatialPoint
}

export const isFiniteAabb = (box: AxisAlignedBoundingBox): boolean =>
  [...box.min, ...box.max].every(Number.isFinite) &&
  box.min.every((value, axis) => value <= box.max[axis])

/** Distinguishes separation, zero-volume contact, and positive-volume penetration without an engineering tolerance. */
export function classifyAabbIntersection(a: AxisAlignedBoundingBox, b: AxisAlignedBoundingBox): AabbIntersection {
  const overlap = [0, 1, 2].map((axis) =>
    metres(Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]))) as unknown as SpatialPoint
  const relationship = overlap.some((value) => value < 0)
    ? 'separated'
    : overlap.every((value) => value > 0)
      ? 'penetration'
      : 'contact'
  return { relationship, overlap }
}

/** Positive-volume intersection. Merely touching faces have zero overlap and do not penetrate. */
export const aabbIntersects = (a: AxisAlignedBoundingBox, b: AxisAlignedBoundingBox): boolean =>
  classifyAabbIntersection(a, b).relationship === 'penetration'

export const aabbContains = (container: AxisAlignedBoundingBox, subject: AxisAlignedBoundingBox): boolean =>
  [0, 1, 2].every((axis) => subject.min[axis] >= container.min[axis] && subject.max[axis] <= container.max[axis])

export const aabbOutside = (container: AxisAlignedBoundingBox, subject: AxisAlignedBoundingBox): boolean =>
  !aabbContains(container, subject)

export function aabbSeparation(a: AxisAlignedBoundingBox, b: AxisAlignedBoundingBox): AxisSeparation {
  const gap = (axis: 0 | 1 | 2) => metres(Math.max(0, a.min[axis] - b.max[axis], b.min[axis] - a.max[axis]))
  const x = gap(0), y = gap(1), z = gap(2)
  return { x, y, z, distance: metres(Math.hypot(x, y, z)) }
}

export const planRectangleFromAabb = (box: AxisAlignedBoundingBox): AxisAlignedPlanRectangle => ({
  minX: box.min[0], maxX: box.max[0], minZ: box.min[2], maxZ: box.max[2],
})

export const planRectangleContains = (container: AxisAlignedPlanRectangle, subject: AxisAlignedPlanRectangle): boolean =>
  subject.minX >= container.minX && subject.maxX <= container.maxX &&
  subject.minZ >= container.minZ && subject.maxZ <= container.maxZ

export const planRectanglesIntersect = (a: AxisAlignedPlanRectangle, b: AxisAlignedPlanRectangle): boolean =>
  a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ

/** Raw distances to the containing faces; negative values mean geometric overflow. */
export function measureGeometricClearances(
  container: AxisAlignedBoundingBox,
  subject: AxisAlignedBoundingBox,
): GeometricClearances {
  return {
    left: metres(subject.min[0] - container.min[0]),
    right: metres(container.max[0] - subject.max[0]),
    front: metres(container.max[2] - subject.max[2]),
    rear: metres(subject.min[2] - container.min[2]),
    top: metres(container.max[1] - subject.max[1]),
    bottom: metres(subject.min[1] - container.min[1]),
  }
}

export function measurePlanClearances(
  container: AxisAlignedPlanRectangle,
  subject: AxisAlignedPlanRectangle,
): GeometricClearances {
  return {
    left: metres(subject.minX - container.minX),
    right: metres(container.maxX - subject.maxX),
    front: metres(container.maxZ - subject.maxZ),
    rear: metres(subject.minZ - container.minZ),
  }
}

export function translateAabb(box: AxisAlignedBoundingBox, offset: SpatialPoint): AxisAlignedBoundingBox {
  return {
    min: box.min.map((value, axis) => metres(value + offset[axis])) as unknown as SpatialPoint,
    max: box.max.map((value, axis) => metres(value + offset[axis])) as unknown as SpatialPoint,
  }
}

/** Analytic vertical union of a rigid envelope over a supplied displacement interval. */
export function createVerticalSweptAabb(
  box: AxisAlignedBoundingBox,
  minimumOffsetY: Metres,
  maximumOffsetY: Metres,
): AxisAlignedBoundingBox {
  const lower = Math.min(minimumOffsetY, maximumOffsetY)
  const upper = Math.max(minimumOffsetY, maximumOffsetY)
  return {
    min: [box.min[0], metres(box.min[1] + lower), box.min[2]],
    max: [box.max[0], metres(box.max[1] + upper), box.max[2]],
  }
}

export function unionAabbs(boxes: readonly AxisAlignedBoundingBox[]): AxisAlignedBoundingBox | undefined {
  if (!boxes.length) return undefined
  return {
    min: [0, 1, 2].map((axis) => metres(Math.min(...boxes.map((box) => box.min[axis])))) as unknown as SpatialPoint,
    max: [0, 1, 2].map((axis) => metres(Math.max(...boxes.map((box) => box.max[axis])))) as unknown as SpatialPoint,
  }
}
