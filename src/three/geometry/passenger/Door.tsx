import { DoubleSide } from 'three'
import { TECHNICAL_MATERIALS } from '../../materials/technical-materials'
import type { PassengerCabinModel } from './passenger-installation-model'

export interface DoorProps {
  readonly cabin: PassengerCabinModel
  readonly side: 'front' | 'rear'
}

export function Door({ cabin, side }: DoorProps) {
  const z = side === 'front' ? cabin.depth / 2 : -cabin.depth / 2
  const panelWidth = cabin.doorWidth / 2
  const y = cabin.bottomY + cabin.doorHeight / 2

  return (
    <group>
      {([-1, 1] as const).map((direction) => (
        <mesh
          key={direction}
          position={[direction * cabin.doorWidth / 4, y, z]}
        >
          <planeGeometry args={[panelWidth, cabin.doorHeight]} />
          <meshStandardMaterial
            color={TECHNICAL_MATERIALS.door}
            metalness={0.25}
            roughness={0.55}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}
