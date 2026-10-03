import { Edges, Line } from '@react-three/drei'
import { TECHNICAL_MATERIALS } from '../../../materials/technical-materials'
import type { PassengerMechanicalLayout, PassengerRailLineLayout } from './passenger-mechanical-layout'
import {
  visualizationBufferHeight,
  visualizationBufferRadius,
  visualizationRailThickness,
  visualizationFrameMemberThickness,
  visualizationSheaveDepth,
} from './mechanical-visualization'

export interface PassengerMechanicalAssemblyProps {
  readonly layout: PassengerMechanicalLayout
  readonly opacity?: number
}

function MechanicalMaterial({
  color,
  opacity,
}: {
  readonly color: string
  readonly opacity: number
}) {
  return (
    <meshStandardMaterial
      color={color}
      depthWrite={opacity >= 1}
      metalness={0.38}
      opacity={opacity}
      roughness={0.48}
      transparent={opacity < 1}
    />
  )
}

function FrameMember({
  segment, member, offset = [0, 0, 0], opacity,
}: {
  readonly segment: PassengerRailLineLayout
  readonly member: number
  readonly offset?: readonly [number, number, number]
  readonly opacity: number
}) {
  const center = segment.start.map((v, i) => (v + segment.end[i]) / 2 + offset[i]) as [number, number, number]
  const size = segment.start.map((v, i) => Math.abs(segment.end[i] - v) || member) as [number, number, number]
  return (
    <mesh position={center}>
      <boxGeometry args={size} />
      <MechanicalMaterial color={TECHNICAL_MATERIALS.carFrame} opacity={opacity} />
      <Edges color={TECHNICAL_MATERIALS.guideRail} />
    </mesh>
  )
}

export function CarFrame({
  frame,
  opacity,
}: {
  readonly frame: NonNullable<PassengerMechanicalLayout['carFrame']>
  readonly opacity: number
}) {
  const member = Math.min(
    visualizationFrameMemberThickness,
    frame.cabinBounds.width / 8,
    frame.cabinBounds.depth / 8,
  )

  return (
    <group>
      {frame.uprights.map((upright, index) => (
        <FrameMember
          key={upright.id}
          segment={upright}
          member={member}
          offset={frame.orientation === 'x'
            ? [(index === 0 ? -1 : 1) * member / 2, 0, 0]
            : [0, 0, (index === 0 ? -1 : 1) * member / 2]}
          opacity={opacity}
        />
      ))}
      <FrameMember segment={frame.crosshead} member={member} offset={[0, member / 2, 0]} opacity={opacity} />
      <FrameMember segment={frame.lowerSling} member={member} offset={[0, -member / 2, 0]} opacity={opacity} />
      {frame.platformSupports.map((support) => (
        <FrameMember key={support.id} segment={support} member={member} offset={[0, -member / 2, 0]} opacity={opacity} />
      ))}
    </group>
  )
}

export function RailSystem({
  railSystem,
  opacity,
}: {
  readonly railSystem: NonNullable<PassengerMechanicalLayout['carRails']>
  readonly opacity: number
}) {
  const color =
    railSystem.kind === 'car'
      ? TECHNICAL_MATERIALS.guideRail
      : TECHNICAL_MATERIALS.counterweightFrame

  return (
    <group>
      {railSystem.rails.map((rail) => (
        <mesh key={rail.id} position={[rail.start[0], (rail.start[1] + rail.end[1]) / 2, rail.start[2]]}>
          <boxGeometry args={[visualizationRailThickness, rail.end[1] - rail.start[1], visualizationRailThickness]} />
          <MechanicalMaterial color={color} opacity={opacity} />
          <Edges color={color} />
        </mesh>
      ))}
    </group>
  )
}

export function CounterweightAssembly({
  counterweight,
  opacity,
}: {
  readonly counterweight: NonNullable<PassengerMechanicalLayout['counterweight']>
  readonly opacity: number
}) {
  const member = Math.min(
    visualizationFrameMemberThickness,
    counterweight.width / 6,
    counterweight.height / 8,
  )
  const innerWidth = Math.max(counterweight.width - member * 3, member)
  const innerHeight = Math.max(counterweight.height - member * 3, member)
  const horizontalMemberWidth = counterweight.width
  const verticalMemberHeight = Math.max(
    counterweight.height - member * 2,
    member,
  )

  return (
    <group position={counterweight.center} rotation={[0, counterweight.rotationY, 0]}>
      {([-1, 1] as const).map((direction) => (
        <mesh
          key={`horizontal-${direction}`}
          position={[0, direction * (counterweight.height / 2 - member / 2), 0]}
        >
          <boxGeometry
            args={[
              horizontalMemberWidth,
              member,
              counterweight.depth,
            ]}
          />
          <MechanicalMaterial
            color={TECHNICAL_MATERIALS.counterweightFrame}
            opacity={opacity}
          />
        </mesh>
      ))}
      {([-1, 1] as const).map((direction) => (
        <mesh
          key={`vertical-${direction}`}
          position={[direction * (counterweight.width / 2 - member / 2), 0, 0]}
        >
          <boxGeometry
            args={[
              member,
              verticalMemberHeight,
              counterweight.depth,
            ]}
          />
          <MechanicalMaterial
            color={TECHNICAL_MATERIALS.counterweightFrame}
            opacity={opacity}
          />
        </mesh>
      ))}
      <mesh>
        <boxGeometry
          args={[innerWidth, innerHeight, counterweight.depth]}
        />
        <MechanicalMaterial
          color={TECHNICAL_MATERIALS.counterweight}
          opacity={opacity}
        />
      </mesh>
    </group>
  )
}

export function Buffers({
  buffers,
  opacity,
}: {
  readonly buffers: NonNullable<PassengerMechanicalLayout['carBuffers']>
  readonly opacity: number
}) {
  return (
    <group>
      {buffers.basePositions.map(([x, y, z], index) => (
        <mesh
          key={`${buffers.kind}-buffer-${index}`}
          position={[x, y + visualizationBufferHeight / 2, z]}
        >
          <cylinderGeometry
            args={[
              visualizationBufferRadius,
              visualizationBufferRadius,
              visualizationBufferHeight,
              16,
            ]}
          />
          <MechanicalMaterial
            color={TECHNICAL_MATERIALS.buffer}
            opacity={opacity}
          />
        </mesh>
      ))}
    </group>
  )
}

export function TractionMachine({
  machine,
  opacity,
}: {
  readonly machine: NonNullable<PassengerMechanicalLayout['machine']>
  readonly opacity: number
}) {
  return (
    <mesh position={machine.center}>
      <boxGeometry args={machine.size} />
      <MechanicalMaterial
        color={TECHNICAL_MATERIALS.machine}
        opacity={opacity}
      />
      <Edges color={TECHNICAL_MATERIALS.machine} />
    </mesh>
  )
}

export function TractionSheave({
  sheave,
  opacity,
}: {
  readonly sheave: NonNullable<PassengerMechanicalLayout['tractionSheave']>
  readonly opacity: number
}) {
  return (
    <mesh position={sheave.center} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry
        args={[
          sheave.diameter / 2,
          sheave.diameter / 2,
          visualizationSheaveDepth,
          32,
        ]}
      />
      <MechanicalMaterial
        color={TECHNICAL_MATERIALS.sheave}
        opacity={opacity}
      />
    </mesh>
  )
}

export function SuspensionPath({
  suspension,
  opacity,
}: {
  readonly suspension: NonNullable<PassengerMechanicalLayout['suspension']>
  readonly opacity: number
}) {
  return (
    <Line
      color={TECHNICAL_MATERIALS.suspension}
      lineWidth={2}
      opacity={opacity}
      points={suspension.path}
      transparent={opacity < 1}
    />
  )
}

export function MechanicalZones({
  layout,
}: {
  readonly layout: PassengerMechanicalLayout
}) {
  return (
    <group>
      {layout.zones.map((zone) => (
        <mesh key={zone.kind} position={[0, zone.centerY, 0]}>
          <boxGeometry args={[zone.width, zone.height, zone.depth]} />
          <meshBasicMaterial
            color={TECHNICAL_MATERIALS.mechanicalZone}
            depthWrite={false}
            opacity={0}
            transparent
          />
          <Edges color={TECHNICAL_MATERIALS.mechanicalZone} />
        </mesh>
      ))}
    </group>
  )
}

export function PassengerMechanicalAssembly({
  layout,
  opacity = 1,
}: PassengerMechanicalAssemblyProps) {
  return (
    <group>
      <MechanicalZones layout={layout} />
      {layout.carRails && (
        <RailSystem railSystem={layout.carRails} opacity={opacity} />
      )}
      {layout.counterweightRails && (
        <RailSystem
          railSystem={layout.counterweightRails}
          opacity={opacity}
        />
      )}
      {layout.carFrame && <CarFrame frame={layout.carFrame} opacity={opacity} />}
      {layout.counterweight && (
        <CounterweightAssembly
          counterweight={layout.counterweight}
          opacity={opacity}
        />
      )}
      {layout.carBuffers && (
        <Buffers buffers={layout.carBuffers} opacity={opacity} />
      )}
      {layout.counterweightBuffers && (
        <Buffers buffers={layout.counterweightBuffers} opacity={opacity} />
      )}
      {layout.machine && (
        <TractionMachine machine={layout.machine} opacity={opacity} />
      )}
      {layout.tractionSheave && (
        <TractionSheave sheave={layout.tractionSheave} opacity={opacity} />
      )}
      {layout.suspension && (
        <SuspensionPath suspension={layout.suspension} opacity={opacity} />
      )}
    </group>
  )
}
