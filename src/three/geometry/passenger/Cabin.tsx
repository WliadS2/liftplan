import { DoubleSide } from 'three'
import { TECHNICAL_MATERIALS } from '../../materials/technical-materials'
import { Door } from './Door'
import type { PassengerCabinModel } from './passenger-installation-model'

interface EntranceFrameProps {
  readonly cabin: PassengerCabinModel
  readonly side: 'front' | 'rear'
}

function EntranceFrame({ cabin, side }: EntranceFrameProps) {
  const z = side === 'front' ? cabin.depth / 2 : -cabin.depth / 2
  const jambWidth = (cabin.width - cabin.doorWidth) / 2
  const headerHeight = cabin.height - cabin.doorHeight
  const jambY = cabin.bottomY + cabin.doorHeight / 2
  const headerY = cabin.bottomY + cabin.doorHeight + headerHeight / 2

  return (
    <group>
      {jambWidth > 0 &&
        ([-1, 1] as const).map((direction) => (
          <mesh
            key={direction}
            position={[
              direction * (cabin.doorWidth / 2 + jambWidth / 2),
              jambY,
              z,
            ]}
          >
            <planeGeometry args={[jambWidth, cabin.doorHeight]} />
            <meshStandardMaterial
              color={TECHNICAL_MATERIALS.cabinWall}
              roughness={0.72}
              side={DoubleSide}
            />
          </mesh>
        ))}
      {headerHeight > 0 && (
        <mesh position={[0, headerY, z]}>
          <planeGeometry args={[cabin.width, headerHeight]} />
          <meshStandardMaterial
            color={TECHNICAL_MATERIALS.cabinWall}
            roughness={0.72}
            side={DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

export interface CabinProps {
  readonly cabin: PassengerCabinModel
}

export function Cabin({ cabin }: CabinProps) {
  return (
    <group>
      <mesh
        position={[0, cabin.bottomY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[cabin.width, cabin.depth]} />
        <meshStandardMaterial
          color={TECHNICAL_MATERIALS.cabinFloor}
          roughness={0.8}
          side={DoubleSide}
        />
      </mesh>

      <mesh
        position={[0, cabin.bottomY + cabin.height, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[cabin.width, cabin.depth]} />
        <meshStandardMaterial
          color={TECHNICAL_MATERIALS.cabinWall}
          roughness={0.72}
          side={DoubleSide}
        />
      </mesh>

      {([-1, 1] as const).map((direction) => (
        <mesh
          key={direction}
          position={[
            direction * cabin.width / 2,
            cabin.centerY,
            0,
          ]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <planeGeometry args={[cabin.depth, cabin.height]} />
          <meshStandardMaterial
            color={TECHNICAL_MATERIALS.cabinWall}
            roughness={0.72}
            side={DoubleSide}
          />
        </mesh>
      ))}

      <EntranceFrame cabin={cabin} side="front" />
      <Door cabin={cabin} side="front" />

      {cabin.throughCar ? (
        <>
          <EntranceFrame cabin={cabin} side="rear" />
          <Door cabin={cabin} side="rear" />
        </>
      ) : (
        <mesh position={[0, cabin.centerY, -cabin.depth / 2]}>
          <planeGeometry args={[cabin.width, cabin.height]} />
          <meshStandardMaterial
            color={TECHNICAL_MATERIALS.cabinWall}
            roughness={0.72}
            side={DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}
