import { TECHNICAL_MATERIALS } from '../../materials/technical-materials'
import {
  getPassengerViewVisibility,
  type ThreeViewMode,
} from '../../scene/view-mode'
import { CabinWall } from './CabinWall'
import { DoorAssembly } from './Door'
import type {
  PassengerCabinModel,
  PassengerEntranceModel,
} from './passenger-installation-model'
import {
  visualizationDoorThickness,
  visualizationFloorThickness,
  visualizationFrameDepth,
  visualizationSillDepth,
  visualizationSillThickness,
  visualizationWallThickness,
} from './visualization-geometry'

export interface EntranceAssemblyProps {
  readonly cabin: PassengerCabinModel
  readonly entrance: PassengerEntranceModel
  readonly viewMode: ThreeViewMode
}

export function EntranceAssembly({
  cabin,
  entrance,
  viewMode,
}: EntranceAssemblyProps) {
  const visibility = getPassengerViewVisibility(viewMode)
  const isFront = entrance.side === 'front'
  const direction = isFront ? 1 : -1
  const wallThickness = Math.min(
    visualizationWallThickness,
    cabin.depth / 4,
  )
  const floorThickness = Math.min(
    visualizationFloorThickness,
    cabin.height / 4,
  )
  const doorThickness = Math.min(
    visualizationDoorThickness,
    cabin.depth / 8,
  )
  const frameDepth = Math.min(
    visualizationFrameDepth,
    cabin.width / 8,
    cabin.height / 8,
    cabin.depth / 8,
  )
  const jambWidth = (cabin.width - entrance.width) / 2
  const headerHeight = cabin.height - entrance.height
  const wallZ = direction * (cabin.depth / 2 - wallThickness / 2)
  const doorZ =
    direction *
    (cabin.depth / 2 - wallThickness - doorThickness / 2)
  const showWallSections = !isFront || visibility.showFrontWallSections
  const doorOpacity = isFront
    ? visibility.frontDoorOpacity
    : visibility.cabinShellOpacity

  return (
    <group>
      {jambWidth > 0 &&
        ([-1, 1] as const).map((xDirection) => (
          <CabinWall
            key={xDirection}
            dimensions={[jambWidth, entrance.height, wallThickness]}
            position={[
              xDirection * (entrance.width / 2 + jambWidth / 2),
              cabin.bottomY + entrance.height / 2,
              wallZ,
            ]}
            visible={showWallSections}
            opacity={visibility.cabinShellOpacity}
          />
        ))}

      {headerHeight > 0 && (
        <CabinWall
          dimensions={[cabin.width, headerHeight, wallThickness]}
          position={[
            0,
            cabin.bottomY + entrance.height + headerHeight / 2,
            wallZ,
          ]}
          visible={showWallSections}
          opacity={visibility.cabinShellOpacity}
        />
      )}

      <DoorAssembly
        bottomY={cabin.bottomY}
        entrance={entrance}
        opacity={doorOpacity}
        thickness={doorThickness}
        z={doorZ}
      />

      <mesh
        position={[
          0,
          cabin.bottomY + Math.min(visualizationSillThickness, floorThickness) / 2,
          direction * (cabin.depth / 2 - visualizationSillDepth / 2),
        ]}
      >
        <boxGeometry
          args={[
            entrance.width,
            Math.min(visualizationSillThickness, floorThickness),
            Math.min(visualizationSillDepth, cabin.depth / 3),
          ]}
        />
        <meshStandardMaterial
          color={TECHNICAL_MATERIALS.sill}
          depthWrite={visibility.cabinShellOpacity >= 1}
          metalness={0.3}
          opacity={visibility.cabinShellOpacity}
          roughness={0.48}
          transparent={visibility.cabinShellOpacity < 1}
        />
      </mesh>

      {showWallSections && (
        <mesh position={[0, cabin.bottomY + entrance.height, wallZ]}>
          <boxGeometry
            args={[
              entrance.width + frameDepth,
              frameDepth,
              wallThickness + frameDepth,
            ]}
          />
          <meshStandardMaterial
            color={TECHNICAL_MATERIALS.doorFrame}
            depthWrite={visibility.cabinShellOpacity >= 1}
            metalness={0.16}
            opacity={visibility.cabinShellOpacity}
            roughness={0.6}
            transparent={visibility.cabinShellOpacity < 1}
          />
        </mesh>
      )}
    </group>
  )
}
