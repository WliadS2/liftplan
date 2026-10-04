import { ExtrudeGeometry, Shape } from 'three'
import type { TRailProfile } from './rail-profile'

/** One continuous prism. Profile U maps to X, V maps to Z, rail length maps to +Y. */
export function createRailExtrusion(profile: Pick<TRailProfile, 'points'>, length: number): ExtrudeGeometry {
  if (!Number.isFinite(length) || length <= 0) throw new Error('Rail extrusion requires a positive length')
  const shape = new Shape()
  profile.points.forEach(([u, v], i) => {
    if (i === 0) shape.moveTo(u, -v)
    else shape.lineTo(u, -v)
  })
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: length, steps: 1, bevelEnabled: false, curveSegments: 1 })
  geometry.rotateX(-Math.PI / 2)
  geometry.computeBoundingBox()
  return geometry
}
