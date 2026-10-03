import { Edges } from '@react-three/drei'
import { TECHNICAL_MATERIALS } from '../../materials/technical-materials'
import type {
  PassengerDoorLeafModel,
  PassengerEntranceModel,
} from './passenger-installation-model'
export interface DoorLeafProps {
  readonly leaf: PassengerDoorLeafModel
  readonly opacity: number
  readonly thickness: number
  readonly y: number
  readonly z: number
}

export function DoorLeaf({ leaf, opacity, thickness, y, z }: DoorLeafProps) {
  const xDirection = leaf.position === 'left' ? -1 : 1

  return (
    <mesh position={[xDirection * leaf.width / 2, y, z]}>
      <boxGeometry args={[leaf.width, leaf.height, thickness]} />
      <meshStandardMaterial
        color={TECHNICAL_MATERIALS.door}
        depthWrite={opacity >= 1}
        metalness={0.22}
        opacity={opacity}
        roughness={0.52}
        transparent={opacity < 1}
      />
      <Edges color={TECHNICAL_MATERIALS.doorEdge} />
    </mesh>
  )
}

export interface DoorAssemblyProps {
  readonly bottomY: number
  readonly entrance: PassengerEntranceModel
  readonly opacity?: number
  readonly thickness: number
  readonly z: number
}

export function DoorAssembly({
  bottomY,
  entrance,
  opacity = 1,
  thickness,
  z,
}: DoorAssemblyProps) {
  const y = bottomY + entrance.height / 2

  return (
    <group>
      {entrance.doorLeaves.map((leaf) => (
        <DoorLeaf
          key={leaf.id}
          leaf={leaf}
          opacity={opacity}
          thickness={thickness}
          y={y}
          z={z}
        />
      ))}
    </group>
  )
}
