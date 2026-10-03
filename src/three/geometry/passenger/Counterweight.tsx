import { DoubleSide } from 'three'
import { TECHNICAL_MATERIALS } from '../../materials/technical-materials'
import type { PassengerCounterweightModel } from './passenger-installation-model'

export interface CounterweightProps {
  readonly counterweight: PassengerCounterweightModel
}

export function Counterweight({ counterweight }: CounterweightProps) {
  return (
    <mesh
      position={counterweight.center}
      rotation={[0, counterweight.rotationY, 0]}
    >
      <planeGeometry args={[counterweight.width, counterweight.height]} />
      <meshStandardMaterial
        color={TECHNICAL_MATERIALS.counterweight}
        metalness={0.2}
        polygonOffset
        polygonOffsetFactor={-1}
        roughness={0.65}
        side={DoubleSide}
      />
    </mesh>
  )
}
