import { Line } from '@react-three/drei'
import { DoubleSide } from 'three'

type Vector = readonly [number, number, number]

/** Presentation of the existing envelope's far faces, not additional structural parts.
 * The +X/+Z near faces and their obstructing edges are omitted. No dimensions are inferred. */
export function ShaftSection({ center, size, color }: {
  readonly center: Vector; readonly size: Vector; readonly color: string
}) {
  const [width, height, depth] = size
  const x = width / 2, y = height / 2, z = depth / 2
  return <group name="shaft-section-walls" position={center}>
    <mesh position={[0, 0, -z]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color={color} depthWrite={false} opacity={0.22} roughness={0.9} side={DoubleSide} transparent />
    </mesh>
    <mesh position={[-x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[depth, height]} />
      <meshStandardMaterial color={color} depthWrite={false} opacity={0.22} roughness={0.9} side={DoubleSide} transparent />
    </mesh>
    <Line points={[
      [x,-y,-z],[x,y,-z], [x,y,-z],[-x,y,-z], [-x,y,-z],[-x,-y,-z],
      [-x,-y,-z],[x,-y,-z], [-x,y,-z],[-x,y,z], [-x,y,z],[-x,-y,z],
      [-x,-y,z],[-x,-y,-z],
    ]} segments color={color} lineWidth={1} />
  </group>
}
