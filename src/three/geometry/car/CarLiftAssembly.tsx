import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import { DoubleSide } from 'three'
import { CAR_CONTACT_SYMBOL_RADIUS_METRES, type CarLiftRenderModel, type CarRenderableAssembly } from './car-lift-render-model'
import { TechnicalEnvelope, TechnicalSceneLabel } from '../TechnicalEnvelope'
import { isCarMovingAssembly } from './car-motion-bindings'
import { CarrierDoor } from '../carrier/CarrierDoor'
import { createCarrierDoorLayouts } from '../carrier/carrier-door-model'
import { ShaftSection } from '../ShaftSection'
import { CarrierDriveAssembly } from '../carrier/CarrierDriveAssembly'
import { ConfiguredMechanicalPart } from '../mechanical/ConfiguredMechanicalPart'
import { hasConfiguredMechanicalVisual } from '../mechanical/mechanical-visual-model'

/** Screen-space annotation spacing, never vehicle dimensions or contact offsets. */
const referenceLabelOffsets: Readonly<Record<string, readonly [number, number]>> = {
  'car-wheelbase': [65, 0], 'car-track': [-80, 0],
  'car-rear-overhang': [0, -28], 'car-front-overhang': [0, 28],
}

function CarPrimitive({ assembly: a }: { readonly assembly: CarRenderableAssembly }) {
  const { color, opacity, presentation } = a.appearance
  if ('start' in a) return <group name={a.id} renderOrder={20}>
    <Line points={[a.start, a.end]} color={color} transparent opacity={opacity}
      dashed={a.appearance.dashed} dashSize={0.12} gapSize={0.06} lineWidth={a.appearance.lineWidth ?? 1.4} depthTest={false} />
    {a.label && <TechnicalSceneLabel screenOffset={referenceLabelOffsets[a.id]} position={[(a.start[0]+a.end[0])/2, (a.start[1]+a.end[1])/2,
      (a.start[2]+a.end[2])/2]}>{a.label}</TechnicalSceneLabel>}
  </group>
  if (presentation === 'section') return <ShaftSection center={a.center} size={a.size} color={color} />
  if (presentation === 'marker') {
    const r = CAR_CONTACT_SYMBOL_RADIUS_METRES
    return <group name={a.id} position={a.center} renderOrder={20}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r, 12]} />
        <meshBasicMaterial color={color} side={DoubleSide} depthTest={false} depthWrite={false} transparent />
      </mesh>
      <Line points={[[-r, 0, 0], [r, 0, 0]]} color={color} lineWidth={3} depthTest={false} transparent />
      <Line points={[[0, 0, -r], [0, 0, r]]} color={color} lineWidth={3} depthTest={false} transparent />
    </group>
  }
  if (presentation === 'line') return <Line name={a.id} points={[
    [a.center[0], a.center[1] - a.size[1] / 2, a.center[2]],
    [a.center[0], a.center[1] + a.size[1] / 2, a.center[2]],
  ]} color={color} lineWidth={1.6} />
  const [w, h, d] = a.size
  const plane = h === 0 ? { args: [w, d] as const, rotation: [-Math.PI / 2, 0, 0] as const }
    : d === 0 ? { args: [w, h] as const, rotation: [0, 0, 0] as const }
      : { args: [d, h] as const, rotation: [0, Math.PI / 2, 0] as const }
  return <group name={a.id} position={a.center} rotation={[0, (a.headingDegrees ?? 0) * Math.PI / 180, 0]}
    userData={{ semanticKind: a.kind }}>
    <mesh rotation={a.size.some((v) => v === 0) ? plane.rotation : [0, 0, 0]}>
      {a.size.some((v) => v === 0) ? <planeGeometry args={plane.args} /> : <boxGeometry args={a.size} />}
      {presentation === 'outline' ? <meshBasicMaterial visible={false} />
        : <meshStandardMaterial color={color} metalness={0.4} roughness={0.48} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} side={DoubleSide} />}
    </mesh>
    <TechnicalEnvelope size={a.size} color={color} opacity={presentation === 'surface' ? Math.min(0.9, opacity * 1.6 + 0.15) : opacity}
      lineWidth={a.appearance.lineWidth} dashed={a.appearance.dashed} />
    {(a.kind === 'approach-envelope' || a.kind === 'door-passage-envelope' || a.kind === 'vehicle-swept-envelope') &&
      <TechnicalSceneLabel position={[0, h / 2, 0]}>{a.kind === 'approach-envelope'
        ? a.id.includes('entry') ? 'Einfahrtshülle' : 'Ausfahrtshülle'
        : a.kind === 'door-passage-envelope' ? `Durchfahrt ${a.id.endsWith('rear') ? 'hinten' : 'vorne'}` : 'Bewegungshülle'}</TechnicalSceneLabel>}
  </group>
}

/** Dedicated Autoaufzug materialization; no goods assembly, store, or vehicle calculation. */
export function CarLiftAssembly({ model }: { readonly model: CarLiftRenderModel }) {
  const boxAssemblies = useMemo(()=>model.assemblies.filter((part)=>'center' in part),[model.assemblies])
  const doors = createCarrierDoorLayouts(model.assemblies.filter((a)=>'center' in a))
  const primitive = (a: CarRenderableAssembly) => {
    const door = doors.find((d)=>d.id === a.id)
    return door ? <CarrierDoor key={a.id} door={door} cutaway={model.viewMode === 'cutaway'} inspection={model.viewMode === 'doors'} />
      : 'center' in a && hasConfiguredMechanicalVisual(a) ? <ConfiguredMechanicalPart key={a.id} input={a}
        assemblies={boxAssemblies} opacity={a.appearance.opacity}/>
      : <CarPrimitive key={a.id} assembly={a} />
  }
  return <group name="car-lift-assembly">
    <group name="car-fixed-assembly">{model.assemblies.filter((a) => !('driveAttachment' in a) && !isCarMovingAssembly(a)).map(primitive)}</group>
    <group name="car-moving-assembly">{model.assemblies.filter((a)=>!('driveAttachment' in a) && isCarMovingAssembly(a)).map(primitive)}</group>
    <CarrierDriveAssembly drive={model.drive} visibleIds={new Set(model.assemblies.map((a)=>a.id))} mode={model.viewMode}/>
  </group>
}
