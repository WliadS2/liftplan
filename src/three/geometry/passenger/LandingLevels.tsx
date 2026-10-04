import { PointMaterial, Points } from '@react-three/drei'
import { useMemo } from 'react'
import { DoubleSide } from 'three'
import { TECHNICAL_MATERIALS } from '../../materials/technical-materials'
import type { PassengerLandingLevelModel, PassengerLevelFootprintModel } from './passenger-installation-model'

/** Level reference surfaces only. Actual landing entrances are independent normalized door assemblies. */
export function LandingLevels({ footprint, levels, opacity = 0.12 }: {
  readonly footprint?: PassengerLevelFootprintModel; readonly levels: readonly PassengerLandingLevelModel[]; readonly opacity?: number
}) {
  const markerPositions = useMemo(() => new Float32Array(levels.flatMap((level) => [0, level.elevationY, 0])), [levels])
  return <group>
    {!footprint && levels.length > 0 && <Points positions={markerPositions} stride={3}>
      <PointMaterial color={TECHNICAL_MATERIALS.landing} size={6} sizeAttenuation={false} />
    </Points>}
    {footprint && levels.map((level) => <mesh key={level.id} position={[0, level.elevationY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[footprint.width, footprint.depth]} />
      <meshStandardMaterial color={TECHNICAL_MATERIALS.landing} opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={1} roughness={0.85} side={DoubleSide} transparent />
    </mesh>)}
  </group>
}
