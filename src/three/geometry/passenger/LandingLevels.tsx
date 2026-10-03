import { Line, PointMaterial, Points } from '@react-three/drei'
import { useMemo } from 'react'
import { DoubleSide } from 'three'
import { TECHNICAL_MATERIALS } from '../../materials/technical-materials'
import type {
  PassengerCabinModel,
  PassengerEntranceModel,
  PassengerLandingLevelModel,
  PassengerLevelFootprintModel,
  PassengerShaftModel,
} from './passenger-installation-model'

interface LandingDoorOpeningProps {
  readonly entrance: PassengerEntranceModel
  readonly elevationY: number
  readonly shaftDepth: number
  readonly side: 'front' | 'rear'
}

function LandingDoorOpening({
  entrance,
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
        [-entrance.width / 2, elevationY, z],
        [-entrance.width / 2, elevationY + entrance.height, z],
        [entrance.width / 2, elevationY + entrance.height, z],
        [entrance.width / 2, elevationY, z],
      ]}
    />
  )
}

export interface LandingLevelsProps {
  readonly cabin?: PassengerCabinModel
  readonly footprint?: PassengerLevelFootprintModel
  readonly levels: readonly PassengerLandingLevelModel[]
  readonly shaft?: PassengerShaftModel
}

export function LandingLevels({
  cabin,
  footprint,
  levels,
  shaft,
}: LandingLevelsProps) {
  const frontEntrance = cabin?.entrances.find(
    (entrance) => entrance.side === 'front',
  )
  const rearEntrance = cabin?.entrances.find(
    (entrance) => entrance.side === 'rear',
  )
  const markerPositions = useMemo(
    () =>
      new Float32Array(
        levels.flatMap((level) => [0, level.elevationY, 0]),
      ),
    [levels],
  )

  return (
    <group>
      {!footprint && levels.length > 0 && (
        <Points positions={markerPositions} stride={3}>
          <PointMaterial
            color={TECHNICAL_MATERIALS.landing}
            size={6}
            sizeAttenuation={false}
          />
        </Points>
      )}
      {levels.map((level) => (
        <group key={level.id}>
          {footprint && (
            <mesh
              position={[0, level.elevationY, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[footprint.width, footprint.depth]} />
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
          )}
          {frontEntrance && shaft && (
            <LandingDoorOpening
              entrance={frontEntrance}
              elevationY={level.elevationY}
              shaftDepth={shaft.depth}
              side="front"
            />
          )}
          {rearEntrance && shaft && (
            <LandingDoorOpening
              entrance={rearEntrance}
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
