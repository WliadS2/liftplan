import { DoubleSide } from 'three'
import { TECHNICAL_MATERIALS } from '../../materials/technical-materials'
import type {
  PassengerCabinModel,
  PassengerDoorModel,
} from './passenger-installation-model'

export interface DoorProps {
  readonly cabin: PassengerCabinModel
  readonly door: PassengerDoorModel
  readonly side: 'front' | 'rear'
}

export function Door({ cabin, door, side }: DoorProps) {
  const z = side === 'front' ? cabin.depth / 2 : -cabin.depth / 2
  const panelWidth = door.width / 2
  const y = cabin.bottomY + door.height / 2

  return (
    <group>
      {([-1, 1] as const).map((direction) => (
        <mesh
          key={direction}
          position={[direction * door.width / 4, y, z]}
        >
          <planeGeometry args={[panelWidth, door.height]} />
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
