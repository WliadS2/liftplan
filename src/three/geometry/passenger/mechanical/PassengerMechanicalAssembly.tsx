import { Edges, Line } from '@react-three/drei'
import { TECHNICAL_MATERIALS } from '../../../materials/technical-materials'
import type { PassengerMechanicalLayout, PassengerRailSystemLayout } from './passenger-mechanical-layout'
import type { PassengerMechanicalComponentModel } from './mechanical-component-model'
import { MechanicalComponentMeshes } from './MechanicalComponentMeshes'
import type { TractionDriveModel } from './traction-drive-model'
import { TractionDriveMeshes } from './TractionDriveMeshes'

export interface PassengerMechanicalAssemblyProps {
  readonly layout: PassengerMechanicalLayout
  readonly components: PassengerMechanicalComponentModel
  readonly drive: TractionDriveModel
  readonly opacity?: number
}

/** Axis lines deliberately carry no rail-profile dimensions when component data is absent. */
function RailAxes({ system, opacity }: { readonly system: PassengerRailSystemLayout; readonly opacity: number }) {
  return <group>{system.rails.map((rail) => <Line key={rail.id} points={[rail.start, rail.end]}
    color={TECHNICAL_MATERIALS.guideRail} lineWidth={1} opacity={opacity} transparent={opacity < 1} />)}</group>
}

export function PassengerMechanicalAssembly({ layout, components, drive, opacity = 1 }: PassengerMechanicalAssemblyProps) {
  return <group>
    <MechanicalComponentMeshes model={components} opacity={opacity} />
    {layout.carRails && !components.carRails && <RailAxes system={layout.carRails} opacity={opacity} />}
    {layout.counterweightRails && !components.counterweightRails && <RailAxes system={layout.counterweightRails} opacity={opacity} />}
    {layout.carFrame && !components.carSling && <group>
      {[...layout.carFrame.uprights, layout.carFrame.crosshead, layout.carFrame.lowerSling, ...layout.carFrame.platformSupports].map((line) =>
        <Line key={line.id} points={[line.start, line.end]} color={TECHNICAL_MATERIALS.carFrame} lineWidth={1} />)}
    </group>}
    {layout.counterweight && !components.counterweightFrame && <mesh position={layout.counterweight.center} rotation={[0, layout.counterweight.rotationY, 0]}>
      <boxGeometry args={[layout.counterweight.width, layout.counterweight.height, layout.counterweight.depth]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      <Edges color={TECHNICAL_MATERIALS.counterweightFrame} />
    </mesh>}
    <TractionDriveMeshes model={drive} />
    {layout.machine && !drive.machine && <mesh position={layout.machine.center}>
      <boxGeometry args={layout.machine.size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      <Edges color={TECHNICAL_MATERIALS.machine} />
    </mesh>}
    {layout.suspension && !drive.suspension && <Line color={TECHNICAL_MATERIALS.suspension} lineWidth={1} opacity={opacity}
      points={layout.suspension.path} transparent={opacity < 1} />}
    {layout.zones.map((zone) => <mesh key={zone.kind} position={[0, zone.centerY, 0]}>
      <boxGeometry args={[zone.width, zone.height, zone.depth]} />
      <meshBasicMaterial color={TECHNICAL_MATERIALS.mechanicalZone} depthWrite={false} opacity={0} transparent />
      <Edges color={TECHNICAL_MATERIALS.mechanicalZone} />
    </mesh>)}
  </group>
}
