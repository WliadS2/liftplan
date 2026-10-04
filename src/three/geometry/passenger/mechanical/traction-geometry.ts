import { Curve, LatheGeometry, TubeGeometry, Vector2, Vector3 } from 'three'
import type { SheaveModel } from './sheave-model'
import type { CableSegment } from './cable-segment'
import type { Metres } from '../../../../engineering'
import { drivePoint, transformDrivePoint } from './drive-geometry'

/** Shared rotational-wheel geometry; local rotation axis is +Z, independent of placement. */
export function createSheaveGeometry(model: Pick<SheaveModel, 'latheProfile'>): LatheGeometry {
  const geometry = new LatheGeometry(model.latheProfile.map(([r, z]) => new Vector2(r, z)), 48)
  geometry.rotateX(Math.PI / 2)
  geometry.computeBoundingBox()
  return geometry
}

/** Analytic lines/arcs prevent spline overshoot through the sheave or moving assemblies. */
class ExplicitRopeCurve extends Curve<Vector3> {
  private readonly intervals: readonly number[]
  readonly intervalCount: number
  private readonly segments: readonly CableSegment[]
  constructor(segments: readonly CableSegment[]) {
    super()
    this.segments = segments
    this.intervals = segments.map((s) => s.kind === 'line' ? 1 : Math.ceil(Math.abs(s.exitAngle - s.entryAngle) / (Math.PI / 24)))
    this.intervalCount = this.intervals.reduce((sum, count) => sum + count, 0)
  }
  private sample(t: number): { segment: CableSegment; fraction: number } {
    let interval = Math.max(0, Math.min(1, t)) * this.intervalCount
    for (let i = 0; i < this.segments.length; i++) {
      if (interval <= this.intervals[i] || i === this.segments.length - 1) {
        return { segment: this.segments[i], fraction: Math.min(1, interval / this.intervals[i]) }
      }
      interval -= this.intervals[i]
    }
    throw new Error('A rope needs explicit nonzero segments')
  }
  getPoint(t: number, target = new Vector3()): Vector3 {
    const { segment, fraction } = this.sample(t)
    if (segment.kind === 'line') return target.set(...segment.start).lerp(new Vector3(...segment.end), fraction)
    const angle = segment.entryAngle + fraction * (segment.exitAngle - segment.entryAngle)
    return target.set(...transformDrivePoint(drivePoint(segment.radius * Math.cos(angle), segment.radius * Math.sin(angle), segment.axialOffset), segment.center, segment.rotationY))
  }
  getTangent(t: number, target = new Vector3()): Vector3 {
    const { segment, fraction } = this.sample(t)
    if (segment.kind === 'line') return target.set(...segment.end).sub(new Vector3(...segment.start)).normalize()
    const angle = segment.entryAngle + fraction * (segment.exitAngle - segment.entryAngle), direction = Math.sign(segment.exitAngle - segment.entryAngle)
    return target.set(...transformDrivePoint(drivePoint(-Math.sin(angle) * direction, Math.cos(angle) * direction, 0), drivePoint(0, 0, 0), segment.rotationY))
  }
  // Keep tube rings at explicit segment boundaries instead of redistributing them by global arc length.
  getPointAt(t: number, target = new Vector3()): Vector3 { return this.getPoint(t, target) }
  getTangentAt(t: number, target = new Vector3()): Vector3 { return this.getTangent(t, target) }
}

export function createTechnicalCableGeometry(rope: { readonly segments: readonly CableSegment[]; readonly diameter: Metres; readonly closed?: boolean }): TubeGeometry {
  const curve = new ExplicitRopeCurve(rope.segments)
  const geometry = new TubeGeometry(curve, curve.intervalCount, rope.diameter / 2, 6, rope.closed === true)
  geometry.computeBoundingBox()
  return geometry
}
// Preserve the traction renderer API while sharing only the low-level geometry factory.
export const createSuspensionRopeGeometry = createTechnicalCableGeometry
