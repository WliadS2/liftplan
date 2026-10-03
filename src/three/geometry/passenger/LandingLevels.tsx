import { Line } from '@react-three/drei'
import { DoubleSide } from 'three'
import { TECHNICAL_MATERIALS } from '../../materials/technical-materials'
import type {
  PassengerCabinModel,
  PassengerLandingLevelModel,
  PassengerShaftModel,
} from './passenger-installation-model'

interface LandingDoorOpeningProps {
  readonly cabin: PassengerCabinModel
  readonly elevationY: number
  readonly shaftDepth: number
  readonly side: 'front' | 'rear'
}

function LandingDoorOpening({
  cabin,
  elevationY,
  shaftDepth,
  side,
}: LandingDoorOpeningProps) {
  const z = side === 'front' ? shaftDepth / 2 : -shaftDepth / 2

  return (
    <Line
      color={TECHNICAL_MATERIALS.door}
      lineWidth={1}
      points={[
        [-cabin.doorWidth / 2, elevationY, z],
        [-cabin.doorWidth / 2, elevationY + cabin.doorHeight, z],
        [cabin.doorWidth / 2, elevationY + cabin.doorHeight, z],
        [cabin.doorWidth / 2, elevationY, z],
      ]}
    />
  )
}

export interface LandingLevelsProps {
  readonly cabin: PassengerCabinModel
  readonly levels: readonly PassengerLandingLevelModel[]
  readonly shaft: PassengerShaftModel
}

export function LandingLevels({ cabin, levels, shaft }: LandingLevelsProps) {
  return (
    <group>
      {levels.map((level) => (
        <group key={level.id}>
          <mesh
            position={[0, level.elevationY, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[shaft.width, shaft.depth]} />
            <meshStandardMaterial
              color={TECHNICAL_MATERIALS.landing}
              opacity={0.12}
              polygonOffset
              polygonOffsetFactor={1}
              roughness={0.85}
              side={DoubleSide}
              transparent
            />
          </mesh>
          <LandingDoorOpening
            cabin={cabin}
            elevationY={level.elevationY}
            shaftDepth={shaft.depth}
            side="front"
          />
          {cabin.throughCar && (
            <LandingDoorOpening
              cabin={cabin}
              elevationY={level.elevationY}
              shaftDepth={shaft.depth}
              side="rear"
            />
          )}
        </group>
      ))}
    </group>
  )
}
