import { Edges, Line } from '@react-three/drei'
import { TECHNICAL_MATERIALS } from '../../../materials/technical-materials'
import type { PassengerMechanicalLayout } from './passenger-mechanical-layout'
import {
  visualizationBufferHeight,
  visualizationBufferRadius,
  visualizationCounterweightDepth,
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

export function CarFrame({
  frame,
  opacity,
}: {
  readonly frame: NonNullable<PassengerMechanicalLayout['carFrame']>
  readonly opacity: number
}) {
  const member = Math.min(
    visualizationFrameMemberThickness,
    frame.width / 8,
    frame.depth / 8,
  )
  const height = frame.topY - frame.bottomY
  const centerY = frame.bottomY + height / 2
  const postX = frame.width / 2 + member / 2

  return (
    <group>
      {([-1, 1] as const).map((direction) => (
        <mesh key={direction} position={[direction * postX, centerY, 0]}>
          <boxGeometry args={[member, height, member]} />
          <MechanicalMaterial
            color={TECHNICAL_MATERIALS.carFrame}
            opacity={opacity}
          />
        </mesh>
      ))}
      {([frame.bottomY, frame.topY] as const).map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[frame.width + member * 2, member, member]} />
          <MechanicalMaterial
            color={TECHNICAL_MATERIALS.carFrame}
            opacity={opacity}
          />
        </mesh>
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
        <Line
          key={rail.id}
          color={color}
          lineWidth={railSystem.kind === 'car' ? 2.5 : 2}
          opacity={opacity}
          points={[rail.start, rail.end]}
          transparent={opacity < 1}
        />
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
              visualizationCounterweightDepth,
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
              visualizationCounterweightDepth,
            ]}
          />
          <MechanicalMaterial
            color={TECHNICAL_MATERIALS.counterweightFrame}
            opacity={opacity}
          />
        </mesh>
      ))}
      <mesh position={[0, 0, visualizationCounterweightDepth / 2]}>
        <boxGeometry
          args={[innerWidth, innerHeight, visualizationCounterweightDepth]}
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
            opacity={0.035}
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
