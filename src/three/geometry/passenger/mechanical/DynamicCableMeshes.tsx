import { useEffect, useMemo } from 'react'
import { CylinderGeometry, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import type { Metres } from '../../../../engineering'
import { cableLineName } from '../../../../simulation/passenger-motion-bindings'
import type { CableSegment } from './cable-segment'
import { createTechnicalCableGeometry } from './traction-geometry'
import { MECHANICAL_MATERIALS } from '../../../materials/technical-materials'

/** Static arc tubes + reusable unit cylinders: no cable geometry allocations during motion. */
export function DynamicCableMeshes({ id, segments, diameter, material, visible = true }: {
  readonly id: string; readonly segments: readonly CableSegment[]; readonly diameter: Metres
  readonly material: 'rope' | 'governorRope'; readonly visible?: boolean
}) {
  const resources = useMemo(() => ({
    cylinder: new CylinderGeometry(1, 1, 1, 6),
    arcs: new Map(segments.flatMap((segment, index) => segment.kind === 'arc'
      ? [[index, createTechnicalCableGeometry({ segments: [segment], diameter })] as const] : [])),
  }), [segments, diameter])
  const sharedMaterial = useMemo(() => new MeshStandardMaterial(MECHANICAL_MATERIALS[material]), [material])
  useEffect(() => () => { resources.cylinder.dispose(); resources.arcs.forEach((geometry) => geometry.dispose()) }, [resources])
  useEffect(() => () => sharedMaterial.dispose(), [sharedMaterial])
  return <group name={id} visible={visible}>{segments.map((segment, index) => {
    if (segment.kind === 'arc') return <mesh key={index} geometry={resources.arcs.get(index)} material={sharedMaterial} />
    const start = new Vector3(...segment.start), end = new Vector3(...segment.end), direction = end.clone().sub(start)
    const center = start.clone().add(end).multiplyScalar(0.5)
    return <mesh key={index} name={cableLineName(id, index)} geometry={resources.cylinder} material={sharedMaterial}
      position={center} quaternion={new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize())}
      scale={[diameter / 2, direction.length(), diameter / 2]} />
  })}</group>
}
