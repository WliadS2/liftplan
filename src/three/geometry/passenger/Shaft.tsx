import { Edges, Line } from '@react-three/drei'
import { ShaftSection } from '../ShaftSection'
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

  if (visibility.showShaftSection) return <ShaftSection center={[0, extent.centerY, 0]}
    size={[shaft.width, extent.height, shaft.depth]} color={TECHNICAL_MATERIALS.shaft} />

  return (
    <group>
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
    </group>
  )
}

export interface PitProps {
  readonly pit: PassengerPitModel
  readonly opacity?: number
}

export function Pit({ pit, opacity = 0.1 }: PitProps) {
  return (
    <mesh position={[0, pit.centerY, 0]}>
      <boxGeometry args={[pit.width, pit.height, pit.depth]} />
      <meshStandardMaterial
        color={TECHNICAL_MATERIALS.pit}
        depthWrite={false}
        opacity={opacity}
        transparent
      />
      <Edges color={TECHNICAL_MATERIALS.pit} />
    </mesh>
  )
}
