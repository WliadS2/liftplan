import { Edges, Line } from '@react-three/drei'
import { TECHNICAL_MATERIALS } from '../../../materials/technical-materials'
import type { PassengerMechanicalLayout, PassengerRailSystemLayout } from './passenger-mechanical-layout'
import type { PassengerMechanicalComponentModel } from './mechanical-component-model'
import { MechanicalComponentMeshes } from './MechanicalComponentMeshes'
import { visualizationSheaveDepth } from './mechanical-visualization'

export interface PassengerMechanicalAssemblyProps {
  readonly layout: PassengerMechanicalLayout
  readonly components: PassengerMechanicalComponentModel
  readonly opacity?: number
}

function MechanicalMaterial({ color, opacity }: { readonly color: string; readonly opacity: number }) {
  return <meshStandardMaterial color={color} depthWrite={opacity >= 1} metalness={0.38}
    opacity={opacity} roughness={0.48} transparent={opacity < 1} />
}

/** Axis lines deliberately carry no rail-profile dimensions when component data is absent. */
function RailAxes({ system, opacity }: { readonly system: PassengerRailSystemLayout; readonly opacity: number }) {
  return <group>{system.rails.map((rail) => <Line key={rail.id} points={[rail.start, rail.end]}
    color={TECHNICAL_MATERIALS.guideRail} lineWidth={1} opacity={opacity} transparent={opacity < 1} />)}</group>
}

export function PassengerMechanicalAssembly({ layout, components, opacity = 1 }: PassengerMechanicalAssemblyProps) {
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
    {layout.machine && <mesh position={layout.machine.center}>
      <boxGeometry args={layout.machine.size} />
      <MechanicalMaterial color={TECHNICAL_MATERIALS.machine} opacity={opacity} />
      <Edges color={TECHNICAL_MATERIALS.machine} />
    </mesh>}
    {layout.tractionSheave && <mesh position={layout.tractionSheave.center} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[layout.tractionSheave.diameter / 2, layout.tractionSheave.diameter / 2, visualizationSheaveDepth, 32]} />
      <MechanicalMaterial color={TECHNICAL_MATERIALS.sheave} opacity={opacity} />
    </mesh>}
    {layout.suspension && <Line color={TECHNICAL_MATERIALS.suspension} lineWidth={2} opacity={opacity}
      points={layout.suspension.path} transparent={opacity < 1} />}
    {layout.zones.map((zone) => <mesh key={zone.kind} position={[0, zone.centerY, 0]}>
      <boxGeometry args={[zone.width, zone.height, zone.depth]} />
      <meshBasicMaterial color={TECHNICAL_MATERIALS.mechanicalZone} depthWrite={false} opacity={0} transparent />
      <Edges color={TECHNICAL_MATERIALS.mechanicalZone} />
    </mesh>)}
  </group>
}
