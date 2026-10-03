import { TECHNICAL_MATERIALS } from '../../materials/technical-materials'
import {
  getPassengerViewVisibility,
  type ThreeViewMode,
} from '../../scene/view-mode'
import { CabinWall } from './CabinWall'
import { EntranceAssembly } from './EntranceAssembly'
import type { PassengerCabinModel } from './passenger-installation-model'
import {
  visualizationFloorThickness,
  visualizationWallThickness,
} from './visualization-geometry'

export interface CabinProps {
  readonly cabin: PassengerCabinModel
  readonly viewMode: ThreeViewMode
}

export function Cabin({ cabin, viewMode }: CabinProps) {
  const visibility = getPassengerViewVisibility(viewMode)
  const wallThickness = Math.min(
    visualizationWallThickness,
    cabin.width / 4,
    cabin.depth / 4,
  )
  const floorThickness = Math.min(
    visualizationFloorThickness,
    cabin.height / 4,
  )
  const shellHeight = Math.max(cabin.height - floorThickness * 2, 0)
  const shellCenterY = cabin.bottomY + floorThickness + shellHeight / 2

  return (
    <group>
      <mesh position={[0, cabin.bottomY + floorThickness / 2, 0]}>
        <boxGeometry args={[cabin.width, floorThickness, cabin.depth]} />
        <meshStandardMaterial
          color={TECHNICAL_MATERIALS.cabinFloor}
          depthWrite={visibility.cabinShellOpacity >= 1}
          metalness={0.05}
          opacity={visibility.cabinShellOpacity}
          roughness={0.82}
          transparent={visibility.cabinShellOpacity < 1}
        />
      </mesh>

      <CabinWall
        dimensions={[cabin.width, floorThickness, cabin.depth]}
        position={[
          0,
          cabin.bottomY + cabin.height - floorThickness / 2,
          0,
        ]}
        opacity={visibility.cabinCeilingOpacity}
      />

      <CabinWall
        dimensions={[wallThickness, shellHeight, cabin.depth]}
        position={[
          -cabin.width / 2 + wallThickness / 2,
          shellCenterY,
          0,
        ]}
        opacity={visibility.cabinShellOpacity}
      />

      <CabinWall
        dimensions={[wallThickness, shellHeight, cabin.depth]}
        position={[
          cabin.width / 2 - wallThickness / 2,
          shellCenterY,
          0,
        ]}
        visible={visibility.showRightCabinWall}
        opacity={visibility.cabinShellOpacity}
      />

      {cabin.rearWall === 'closed' && (
        <CabinWall
          dimensions={[
            cabin.width - wallThickness * 2,
            shellHeight,
            wallThickness,
          ]}
          position={[
            0,
            shellCenterY,
            -cabin.depth / 2 + wallThickness / 2,
          ]}
          opacity={visibility.cabinShellOpacity}
        />
      )}

      {cabin.entrances.map((entrance) => (
        <EntranceAssembly
          key={entrance.side}
          cabin={cabin}
          entrance={entrance}
          viewMode={viewMode}
        />
      ))}
    </group>
  )
}
