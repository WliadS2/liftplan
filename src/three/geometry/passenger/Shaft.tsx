import { Edges, Line } from '@react-three/drei'
import { TECHNICAL_MATERIALS } from '../../materials/technical-materials'
import {
  getPassengerViewVisibility,
  type ThreeViewMode,
} from '../../scene/view-mode'
import type {
  PassengerPitModel,
  PassengerShaftModel,
} from './passenger-installation-model'

export interface ShaftProps {
  readonly shaft: PassengerShaftModel
  readonly viewMode: ThreeViewMode
}

export function Shaft({ shaft, viewMode }: ShaftProps) {
  const extent = shaft.verticalExtent
  const visibility = getPassengerViewVisibility(viewMode)

  if (!extent) {
    return (
      <Line
        color={TECHNICAL_MATERIALS.shaft}
        lineWidth={1.5}
        points={[
          [-shaft.width / 2, 0, -shaft.depth / 2],
          [shaft.width / 2, 0, -shaft.depth / 2],
          [shaft.width / 2, 0, shaft.depth / 2],
          [-shaft.width / 2, 0, shaft.depth / 2],
          [-shaft.width / 2, 0, -shaft.depth / 2],
        ]}
      />
    )
  }

  return (
    <mesh position={[0, extent.centerY, 0]}>
      <boxGeometry args={[shaft.width, extent.height, shaft.depth]} />
      <meshStandardMaterial
        color={TECHNICAL_MATERIALS.shaft}
        depthWrite={false}
        opacity={visibility.shaftEnvelopeOpacity}
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
