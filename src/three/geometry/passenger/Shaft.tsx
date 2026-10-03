import { Edges } from '@react-three/drei'
import { TECHNICAL_MATERIALS } from '../../materials/technical-materials'
import type {
  PassengerPitModel,
  PassengerShaftModel,
} from './passenger-installation-model'

export interface ShaftProps {
  readonly shaft: PassengerShaftModel
}

export function Shaft({ shaft }: ShaftProps) {
  return (
    <mesh position={[0, shaft.centerY, 0]}>
      <boxGeometry args={[shaft.width, shaft.height, shaft.depth]} />
      <meshStandardMaterial
        color={TECHNICAL_MATERIALS.shaft}
        depthWrite={false}
        opacity={0.08}
        roughness={0.9}
        transparent
      />
      <Edges color={TECHNICAL_MATERIALS.shaft} />
    </mesh>
  )
}

export interface PitProps {
  readonly pit: PassengerPitModel
}

export function Pit({ pit }: PitProps) {
  return (
    <mesh position={[0, pit.centerY, 0]}>
      <boxGeometry args={[pit.width, pit.height, pit.depth]} />
      <meshStandardMaterial
        color={TECHNICAL_MATERIALS.pit}
        depthWrite={false}
        opacity={0.14}
        transparent
      />
      <Edges color={TECHNICAL_MATERIALS.pit} />
    </mesh>
  )
}
